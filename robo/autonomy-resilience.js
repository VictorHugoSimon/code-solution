export const AUTONOMY_POLICY_VERSION = 'autonomy-policy-2026-08-27.1';
export const RESILIENCE_AGENT = Object.freeze({
  id: 'governance',
  name: 'Governança & SRE de Agentes',
  domain: 'governance',
  autonomy: 'internal-supervisor',
  status: 'active',
});

const RETRYABLE_RISK = new Set(['low']);
const MAX_RETRY_ATTEMPTS = 3;
const STUCK_MINUTES = 30;

export async function handleResilienceApi(request, env) {
  const url = new URL(request.url);
  const relevant = url.pathname.startsWith('/crm/autonomy/resilience') ||
    url.pathname.startsWith('/crm/autonomy/governance') ||
    url.pathname.startsWith('/crm/autonomy/dlq');
  if (!relevant) return null;

  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok: false, error: 'autonomy_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/autonomy/resilience' && request.method === 'GET') {
    return respond({ ok: true, ...(await getResilienceSummary(env)) }, 200, cors);
  }

  if (url.pathname === '/crm/autonomy/resilience/maintenance' && request.method === 'POST') {
    const maintenance = await runAutonomyMaintenance(env, { trigger: 'manual' });
    return respond({ ok: true, maintenance, ...(await getResilienceSummary(env)) }, 200, cors);
  }

  if (url.pathname === '/crm/autonomy/governance/global' && request.method === 'PATCH') {
    const body = await readJson(request);
    if (typeof body.enabled !== 'boolean') return respond({ ok: false, error: 'enabled_boolean_required' }, 400, cors);
    const now = new Date().toISOString();
    await env.CRM_DB.prepare(`INSERT INTO autonomy_agent_controls (agent_id,enabled,shadow_mode,max_tasks_per_run,note,updated_at)
      VALUES ('__global__',?,0,50,?,?)
      ON CONFLICT(agent_id) DO UPDATE SET enabled=excluded.enabled,note=excluded.note,updated_at=excluded.updated_at`)
      .bind(body.enabled ? 1 : 0, cleanText(body.note || (body.enabled ? 'Autonomia global habilitada pelo painel' : 'Kill switch global acionado pelo painel'), 500), now).run();
    return respond({ ok: true, globalEnabled: body.enabled, control: await getControl(env, '__global__') }, 200, cors);
  }

  if (url.pathname === '/crm/autonomy/dlq' && request.method === 'GET') {
    const limit = clamp(Number(url.searchParams.get('limit') || 100), 1, 250);
    const result = await env.CRM_DB.prepare(`SELECT d.*,t.title,t.status AS task_status,t.risk_level,t.approval_required,t.entity_type,t.entity_id
      FROM autonomy_dead_letters d JOIN autonomy_tasks t ON t.id=d.task_id
      WHERE d.resolved_at IS NULL ORDER BY d.created_at DESC LIMIT ?`).bind(limit).all();
    return respond({ ok: true, deadLetters: (result.results || []).map(mapDeadLetter) }, 200, cors);
  }

  const requeue = url.pathname.match(/^\/crm\/autonomy\/dlq\/([^/]+)\/requeue$/);
  if (requeue && request.method === 'POST') {
    const dlqId = decodeURIComponent(requeue[1]);
    const row = await env.CRM_DB.prepare(`SELECT d.*,t.risk_level,t.approval_required,t.agent,t.status AS task_status
      FROM autonomy_dead_letters d JOIN autonomy_tasks t ON t.id=d.task_id WHERE d.id=? AND d.resolved_at IS NULL`).bind(dlqId).first();
    if (!row) return respond({ ok: false, error: 'dead_letter_not_found' }, 404, cors);
    if (Number(row.approval_required) !== 0 || !RETRYABLE_RISK.has(String(row.risk_level || ''))) {
      return respond({ ok: false, error: 'dead_letter_not_safe_to_requeue' }, 409, cors);
    }
    const now = new Date().toISOString();
    await env.CRM_DB.batch([
      env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='queued',updated_at=?,error_text=NULL,completed_at=NULL WHERE id=?").bind(now, row.task_id),
      env.CRM_DB.prepare(`INSERT INTO autonomy_task_retries (task_id,attempts,max_attempts,status,next_attempt_at,last_error,created_at,updated_at)
        VALUES (?,0,?,'inflight',NULL,NULL,?,?)
        ON CONFLICT(task_id) DO UPDATE SET attempts=0,max_attempts=excluded.max_attempts,status='inflight',next_attempt_at=NULL,last_error=NULL,updated_at=excluded.updated_at`)
        .bind(row.task_id, MAX_RETRY_ATTEMPTS, now, now),
      env.CRM_DB.prepare("UPDATE autonomy_dead_letters SET resolved_at=?,resolution_note='manual_safe_requeue' WHERE id=?").bind(now, dlqId),
    ]);
    await incrementUsage(env, row.agent, 'retries', 1);
    return respond({ ok: true, taskId: row.task_id, requeued: true }, 200, cors);
  }

  return respond({ ok: false, error: 'not_found' }, 404, cors);
}

export async function isGlobalAutonomyEnabled(env) {
  if (!env?.CRM_DB) return false;
  try {
    const control = await getControl(env, '__global__');
    return control ? Boolean(control.enabled) : false;
  } catch {
    return false;
  }
}

export async function runAutonomyMaintenance(env, { trigger = 'scheduled_30m' } = {}) {
  if (!env?.CRM_DB) return { ok: false, disabled: true, reason: 'db_not_configured' };
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - STUCK_MINUTES * 60_000).toISOString();
  const stats = { trigger, staleRecovered: 0, retriesScheduled: 0, retriesRequeued: 0, recovered: 0, deadLettered: 0 };

  const stale = await env.CRM_DB.prepare("SELECT id FROM autonomy_tasks WHERE status='running' AND updated_at<? LIMIT 100").bind(staleBefore).all();
  for (const task of stale.results || []) {
    await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='failed',updated_at=?,error_text='stuck_running_timeout' WHERE id=? AND status='running'").bind(nowIso, task.id).run();
    stats.staleRecovered++;
  }

  const completed = await env.CRM_DB.prepare(`SELECT r.task_id,t.agent FROM autonomy_task_retries r
    JOIN autonomy_tasks t ON t.id=r.task_id WHERE r.status IN ('retrying','inflight') AND t.status='completed' LIMIT 100`).all();
  for (const row of completed.results || []) {
    await env.CRM_DB.prepare("UPDATE autonomy_task_retries SET status='recovered',next_attempt_at=NULL,updated_at=? WHERE task_id=?").bind(nowIso, row.task_id).run();
    stats.recovered++;
  }

  const failed = await env.CRM_DB.prepare(`SELECT t.id,t.agent,t.action_type,t.payload_json,t.error_text,t.risk_level,t.approval_required,r.attempts,r.max_attempts,r.status AS retry_status,r.next_attempt_at
    FROM autonomy_tasks t LEFT JOIN autonomy_task_retries r ON r.task_id=t.id
    WHERE t.status='failed' AND t.approval_required=0 AND t.risk_level='low'
    ORDER BY t.updated_at ASC LIMIT 150`).all();

  for (const task of failed.results || []) {
    const currentStatus = task.retry_status || '';
    const attempts = Number(task.attempts || 0);
    const maxAttempts = Number(task.max_attempts || MAX_RETRY_ATTEMPTS);

    if (!currentStatus) {
      const next = addMinutes(now, backoffMinutes(1)).toISOString();
      await env.CRM_DB.prepare(`INSERT INTO autonomy_task_retries (task_id,attempts,max_attempts,status,next_attempt_at,last_error,created_at,updated_at)
        VALUES (?,?,?,'retrying',?,?,?,?)`).bind(task.id, 1, maxAttempts, next, cleanText(task.error_text || 'execution_failed', 1000), nowIso, nowIso).run();
      await incrementUsage(env, task.agent, 'failed_tasks', 1);
      stats.retriesScheduled++;
      continue;
    }

    if (currentStatus === 'inflight') {
      if (attempts >= maxAttempts) {
        await deadLetter(env, task, nowIso, `retry_exhausted_after_${attempts}_attempts`);
        stats.deadLettered++;
      } else {
        const nextAttempts = attempts + 1;
        const next = addMinutes(now, backoffMinutes(nextAttempts)).toISOString();
        await env.CRM_DB.prepare("UPDATE autonomy_task_retries SET attempts=?,status='retrying',next_attempt_at=?,last_error=?,updated_at=? WHERE task_id=?")
          .bind(nextAttempts, next, cleanText(task.error_text || 'execution_failed', 1000), nowIso, task.id).run();
        await incrementUsage(env, task.agent, 'failed_tasks', 1);
        stats.retriesScheduled++;
      }
      continue;
    }

    if (currentStatus === 'retrying' && task.next_attempt_at && Date.parse(task.next_attempt_at) <= now.getTime()) {
      await env.CRM_DB.batch([
        env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='queued',updated_at=?,error_text=NULL WHERE id=? AND status='failed'").bind(nowIso, task.id),
        env.CRM_DB.prepare("UPDATE autonomy_task_retries SET status='inflight',next_attempt_at=NULL,updated_at=? WHERE task_id=?").bind(nowIso, task.id),
      ]);
      await incrementUsage(env, task.agent, 'retries', 1);
      stats.retriesRequeued++;
    }
  }

  await reconcileDailyUsage(env);
  return { ok: true, policyVersion: AUTONOMY_POLICY_VERSION, ...stats };
}

export async function enrichResilienceSummaryResponse(response, env) {
  if (!response?.ok || !env?.CRM_DB) return response;
  try {
    const data = await response.json();
    const summary = await getResilienceSummary(env);
    const agents = Array.isArray(data.agents) ? data.agents : [];
    if (!agents.some((agent) => agent.id === RESILIENCE_AGENT.id)) agents.push(RESILIENCE_AGENT);
    data.agents = agents;
    data.resilience = summary;
    data.policy = data.policy || {};
    data.policy.version = AUTONOMY_POLICY_VERSION;
    data.policy.failMode = 'fail_closed';
    data.policy.retry = { risk: ['low'], maxAttempts: MAX_RETRY_ATTEMPTS, deadLetterAfterExhaustion: true };
    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    return new Response(JSON.stringify(data), { status: response.status, headers });
  } catch {
    return response;
  }
}

export async function getResilienceHealth(env) {
  if (!env?.CRM_DB) return { status: 'critical', globalEnabled: false, policyVersion: AUTONOMY_POLICY_VERSION };
  try {
    const summary = await getResilienceSummary(env);
    return {
      status: summary.slo.status,
      globalEnabled: summary.globalEnabled,
      openDeadLetters: summary.slo.openDeadLetters,
      pendingRetries: summary.slo.pendingRetries,
      runSuccessRate24h: summary.slo.runSuccessRate24h,
      policyVersion: AUTONOMY_POLICY_VERSION,
    };
  } catch {
    return { status: 'critical', globalEnabled: false, policyVersion: AUTONOMY_POLICY_VERSION };
  }
}

async function getResilienceSummary(env) {
  const [globalControl, taskCounts, retries, dlq, runs, oldest, usage, policy] = await Promise.all([
    getControl(env, '__global__'),
    env.CRM_DB.prepare("SELECT status,COUNT(*) count FROM autonomy_tasks GROUP BY status").all(),
    env.CRM_DB.prepare("SELECT status,COUNT(*) count FROM autonomy_task_retries GROUP BY status").all(),
    env.CRM_DB.prepare("SELECT COUNT(*) count FROM autonomy_dead_letters WHERE resolved_at IS NULL").first(),
    env.CRM_DB.prepare("SELECT status,COUNT(*) count FROM autonomy_runs WHERE started_at>=datetime('now','-24 hours') GROUP BY status").all(),
    env.CRM_DB.prepare("SELECT MIN(created_at) oldest FROM autonomy_tasks WHERE status IN ('queued','running')").first(),
    env.CRM_DB.prepare("SELECT * FROM autonomy_agent_daily_usage WHERE usage_date=? ORDER BY agent").bind(saoPauloDate()).all(),
    env.CRM_DB.prepare("SELECT policy_version,prompt_version,description,created_at FROM autonomy_policy_versions WHERE active=1 ORDER BY created_at DESC LIMIT 1").first(),
  ]);

  const tasks = rowsToMap(taskCounts.results || []);
  const retryMap = rowsToMap(retries.results || []);
  const runMap = rowsToMap(runs.results || []);
  const successRuns = Number(runMap.success || 0);
  const failedRuns = Number(runMap.failed || 0);
  const totalRuns = successRuns + failedRuns;
  const successRate = totalRuns ? successRuns / totalRuns : 1;
  const oldestAge = oldest?.oldest ? Math.max(0, Math.round((Date.now() - Date.parse(oldest.oldest)) / 60000)) : 0;
  const openDeadLetters = Number(dlq?.count || 0);
  const pendingRetries = Number(retryMap.retrying || 0) + Number(retryMap.inflight || 0);
  const recentFailures = Number(tasks.failed || 0);

  let status = 'healthy';
  if (openDeadLetters > 10 || successRate < 0.5 || oldestAge > 240) status = 'critical';
  else if (openDeadLetters > 0 || successRate < 0.9 || recentFailures > 5 || oldestAge > 60) status = 'degraded';

  return {
    policyVersion: policy?.policy_version || AUTONOMY_POLICY_VERSION,
    promptVersion: policy?.prompt_version || null,
    globalEnabled: Boolean(globalControl?.enabled),
    globalControl,
    taskCounts: tasks,
    retryCounts: retryMap,
    usageToday: (usage.results || []).map((row) => ({
      agent: row.agent,
      completedTasks: Number(row.completed_tasks || 0),
      failedTasks: Number(row.failed_tasks || 0),
      retries: Number(row.retries || 0),
      deadLetters: Number(row.dead_letters || 0),
    })),
    slo: {
      status,
      openDeadLetters,
      pendingRetries,
      runSuccessRate24h: Number(successRate.toFixed(4)),
      oldestActiveTaskAgeMinutes: oldestAge,
      failedTasks: recentFailures,
    },
  };
}

async function getControl(env, agentId) {
  const row = await env.CRM_DB.prepare('SELECT * FROM autonomy_agent_controls WHERE agent_id=?').bind(agentId).first();
  if (!row) return null;
  return {
    agentId: row.agent_id,
    enabled: Boolean(row.enabled),
    shadowMode: Boolean(row.shadow_mode),
    maxTasksPerRun: Number(row.max_tasks_per_run || 0),
    note: row.note || '',
    updatedAt: row.updated_at,
  };
}

async function deadLetter(env, task, nowIso, reason) {
  const id = crypto.randomUUID();
  await env.CRM_DB.batch([
    env.CRM_DB.prepare(`INSERT OR IGNORE INTO autonomy_dead_letters (id,task_id,agent,action_type,reason,payload_json,created_at)
      VALUES (?,?,?,?,?,?,?)`).bind(id, task.id, task.agent, task.action_type, reason, cleanText(task.payload_json || '{}', 7000), nowIso),
    env.CRM_DB.prepare("UPDATE autonomy_task_retries SET status='exhausted',next_attempt_at=NULL,updated_at=? WHERE task_id=?").bind(nowIso, task.id),
  ]);
  await incrementUsage(env, task.agent, 'dead_letters', 1);
}

async function reconcileDailyUsage(env) {
  const date = saoPauloDate();
  const start = `${date}T00:00:00-03:00`;
  const result = await env.CRM_DB.prepare(`SELECT agent,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed
    FROM autonomy_tasks WHERE created_at>=? GROUP BY agent`).bind(start).all();
  const now = new Date().toISOString();
  for (const row of result.results || []) {
    await env.CRM_DB.prepare(`INSERT INTO autonomy_agent_daily_usage (agent,usage_date,completed_tasks,failed_tasks,retries,dead_letters,updated_at)
      VALUES (?,?,?,?,0,0,?)
      ON CONFLICT(agent,usage_date) DO UPDATE SET completed_tasks=excluded.completed_tasks,failed_tasks=excluded.failed_tasks,updated_at=excluded.updated_at`)
      .bind(row.agent, date, Number(row.completed || 0), Number(row.failed || 0), now).run();
  }
}

async function incrementUsage(env, agent, field, value) {
  if (!['completed_tasks','failed_tasks','retries','dead_letters'].includes(field)) return;
  const date = saoPauloDate();
  const now = new Date().toISOString();
  await env.CRM_DB.prepare(`INSERT OR IGNORE INTO autonomy_agent_daily_usage (agent,usage_date,updated_at) VALUES (?,?,?)`).bind(agent || 'unknown', date, now).run();
  await env.CRM_DB.prepare(`UPDATE autonomy_agent_daily_usage SET ${field}=${field}+?,updated_at=? WHERE agent=? AND usage_date=?`)
    .bind(Number(value || 0), now, agent || 'unknown', date).run();
}

function mapDeadLetter(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    agent: row.agent,
    actionType: row.action_type,
    reason: row.reason,
    title: row.title || '',
    taskStatus: row.task_status || '',
    riskLevel: row.risk_level || '',
    approvalRequired: Boolean(row.approval_required),
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    createdAt: row.created_at,
  };
}

function rowsToMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count || 0)]));
}

function backoffMinutes(attempt) {
  return Math.min(60, 5 * (2 ** Math.max(0, Number(attempt || 1) - 1)));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function saoPauloDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function authorizeAdmin(request, env) {
  const expected = env.CRM_ADMIN_KEY || '';
  if (!expected) return false;
  const provided = request.headers.get('x-crm-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return safeEqual(provided, expected);
}

function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a || ''));
  const y = new TextEncoder().encode(String(b || ''));
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = new Set(['https://www.codesolution.com.br', 'https://codesolution.com.br']);
  if (env.ALLOWED_ORIGIN) allowed.add(env.ALLOWED_ORIGIN);
  const headers = {
    'Access-Control-Allow-Headers': 'content-type,x-crm-key,authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function respond(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function cleanText(value, max = 1000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
