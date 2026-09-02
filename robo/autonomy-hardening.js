import { getAiBudgetPolicy } from './ai-client.js';

export const AUTONOMY_HARDENING_VERSION = 'autonomy-hardening-2026-09-02.1';
export const SAFE_REPLAY_ACTIONS = Object.freeze([
  'qualify_prospect',
  'prioritize_hot_lead',
  'ensure_sales_action',
  'generate_proposal_draft',
  'prepare_delivery_handoff',
  'generate_executive_brief',
]);

const SAFE_REPLAY_SET = new Set(SAFE_REPLAY_ACTIONS);
const TERMINAL_STATUSES = "('completed','approved','rejected')";
const MAX_REPLAY_AUDIT = 50;

export async function handleAutonomyHardeningApi(request, env) {
  const url = new URL(request.url);
  const isSummary = url.pathname === '/crm/autonomy/hardening';
  const replayMatch = url.pathname.match(/^\/crm\/autonomy\/dlq\/([^/]+)\/(?:requeue|replay)$/);
  if (!isSummary && !replayMatch) return null;

  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok: false, error: 'autonomy_db_not_configured' }, 503, cors);

  if (isSummary && request.method === 'GET') {
    return respond({ ok: true, ...(await getHardeningSummary(env)) }, 200, cors);
  }

  if (replayMatch && request.method === 'POST') {
    return replayDeadLetter(request, env, decodeURIComponent(replayMatch[1]), cors);
  }

  return respond({ ok: false, error: 'not_found' }, 404, cors);
}

export async function runAutonomyHardeningPreflight(env, { trigger = 'scheduled_30m' } = {}) {
  if (!env?.CRM_DB) return { ok: false, disabled: true, reason: 'db_not_configured' };
  const released = await releaseRecurringDedupeKeys(env);
  const deferred = await promoteDeferredTasks(env);
  return {
    ok: true,
    version: AUTONOMY_HARDENING_VERSION,
    trigger,
    dedupeKeysReleased: released,
    deferredPromoted: deferred,
  };
}

export async function enrichHardeningSummaryResponse(response, env) {
  if (!response?.ok || !env?.CRM_DB) return response;
  try {
    const data = await response.json();
    data.hardening = await getHardeningSummary(env);
    data.policy = data.policy || {};
    data.policy.hardeningVersion = AUTONOMY_HARDENING_VERSION;
    data.policy.queueBudgetEnforced = true;
    data.policy.aiDailyBudget = true;
    data.policy.safeReplayActions = SAFE_REPLAY_ACTIONS;
    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    return new Response(JSON.stringify(data), { status: response.status, headers });
  } catch {
    return response;
  }
}

export function evaluateReplaySafety(task) {
  if (!task) return { safe: false, reason: 'task_missing' };
  if (Number(task.approval_required ?? task.approvalRequired ?? 0) !== 0) return { safe: false, reason: 'approval_required' };
  if (String(task.risk_level ?? task.riskLevel ?? '') !== 'low') return { safe: false, reason: 'risk_not_low' };
  const action = String(task.action_type ?? task.actionType ?? '');
  if (!SAFE_REPLAY_SET.has(action)) return { safe: false, reason: 'action_not_replayable' };
  return { safe: true, reason: 'safe_internal_idempotent_action' };
}

async function replayDeadLetter(request, env, dlqId, cors) {
  const row = await env.CRM_DB.prepare(`SELECT d.*,t.unique_key,t.risk_level,t.approval_required,t.agent,t.action_type,
      t.entity_type,t.entity_id,t.status AS task_status,t.title
    FROM autonomy_dead_letters d JOIN autonomy_tasks t ON t.id=d.task_id
    WHERE d.id=? AND d.resolved_at IS NULL`).bind(dlqId).first();
  if (!row) return respond({ ok: false, error: 'dead_letter_not_found' }, 404, cors);

  const safety = evaluateReplaySafety(row);
  if (!safety.safe) {
    await recordReplayAudit(env, row, 'rejected', safety.reason);
    return respond({ ok: false, error: 'dead_letter_not_safe_to_replay', reason: safety.reason }, 409, cors);
  }

  const duplicate = await findActiveDuplicate(env, row);
  if (duplicate) {
    await recordReplayAudit(env, row, 'rejected', `active_duplicate:${duplicate.id}`);
    return respond({ ok: false, error: 'active_duplicate_exists', duplicateTaskId: duplicate.id }, 409, cors);
  }

  const relevance = await validateEntityStillRelevant(env, row);
  if (!relevance.safe) {
    await recordReplayAudit(env, row, 'rejected', relevance.reason);
    return respond({ ok: false, error: 'replay_entity_no_longer_relevant', reason: relevance.reason }, 409, cors);
  }

  const now = new Date().toISOString();
  await env.CRM_DB.batch([
    env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='queued',updated_at=?,error_text=NULL,completed_at=NULL WHERE id=?")
      .bind(now, row.task_id),
    env.CRM_DB.prepare(`INSERT INTO autonomy_task_retries (task_id,attempts,max_attempts,status,next_attempt_at,last_error,created_at,updated_at)
      VALUES (?,0,3,'inflight',NULL,NULL,?,?)
      ON CONFLICT(task_id) DO UPDATE SET attempts=0,max_attempts=3,status='inflight',next_attempt_at=NULL,last_error=NULL,updated_at=excluded.updated_at`)
      .bind(row.task_id, now, now),
    env.CRM_DB.prepare("UPDATE autonomy_dead_letters SET resolved_at=?,resolution_note='manual_safe_replay' WHERE id=?")
      .bind(now, dlqId),
  ]);
  await recordReplayAudit(env, row, 'requeued', 'manual_safe_replay');
  await incrementRetryUsage(env, row.agent);
  return respond({
    ok: true,
    taskId: row.task_id,
    replayed: true,
    safeReplay: true,
    actionType: row.action_type,
    hardeningVersion: AUTONOMY_HARDENING_VERSION,
  }, 200, cors);
}

async function findActiveDuplicate(env, row) {
  if (!row.entity_type || !row.entity_id) return null;
  return env.CRM_DB.prepare(`SELECT id,status FROM autonomy_tasks
    WHERE id<>? AND agent=? AND action_type=? AND entity_type=? AND entity_id=?
      AND status IN ('queued','running','waiting_approval','deferred')
    ORDER BY created_at DESC LIMIT 1`)
    .bind(row.task_id, row.agent, row.action_type, row.entity_type, row.entity_id).first();
}

async function validateEntityStillRelevant(env, row) {
  const action = String(row.action_type || '');
  const id = row.entity_id;
  if (!id) return { safe: true };

  if (action === 'qualify_prospect') {
    const item = await env.CRM_DB.prepare('SELECT status FROM growth_accounts WHERE id=?').bind(id).first();
    return item && ['novo', 'qualificar'].includes(String(item.status || '')) ? { safe: true } : { safe: false, reason: 'prospect_state_changed' };
  }
  if (action === 'prioritize_hot_lead') {
    const lead = await env.CRM_DB.prepare("SELECT status,score,temperature FROM leads WHERE id=?").bind(id).first();
    if (!lead || ['ganho','perdido','arquivado'].includes(String(lead.status || ''))) return { safe: false, reason: 'lead_closed' };
    return (String(lead.temperature || '') === 'quente' || Number(lead.score || 0) >= 75) ? { safe: true } : { safe: false, reason: 'lead_no_longer_hot' };
  }
  if (action === 'ensure_sales_action' || action === 'generate_proposal_draft') {
    const lead = await env.CRM_DB.prepare('SELECT status FROM leads WHERE id=?').bind(id).first();
    return lead && !['ganho','perdido','arquivado'].includes(String(lead.status || '')) ? { safe: true } : { safe: false, reason: 'lead_closed' };
  }
  if (action === 'prepare_delivery_handoff') {
    const lead = await env.CRM_DB.prepare('SELECT status FROM leads WHERE id=?').bind(id).first();
    return lead && String(lead.status || '') === 'ganho' ? { safe: true } : { safe: false, reason: 'delivery_lead_not_won' };
  }
  return { safe: true };
}

async function releaseRecurringDedupeKeys(env) {
  const now = new Date().toISOString();
  const dayStart = saoPauloDayStartIso();
  const counts = { hotLead: 0, prospect: 0, content: 0 };

  const hotLead = await env.CRM_DB.prepare(`UPDATE autonomy_tasks
    SET unique_key=unique_key || ':cycle-closed:' || id,updated_at=?
    WHERE action_type='prioritize_hot_lead' AND status IN ${TERMINAL_STATUSES}
      AND created_at<? AND unique_key LIKE 'hot-lead:%:priority'`)
    .bind(now, dayStart).run();
  counts.hotLead = changes(hotLead);

  const prospect = await env.CRM_DB.prepare(`UPDATE autonomy_tasks
    SET unique_key=unique_key || ':state-closed:' || id,updated_at=?
    WHERE action_type IN ('qualify_prospect','external_outreach') AND status IN ${TERMINAL_STATUSES}
      AND (unique_key LIKE 'prospect:%:qualify' OR unique_key LIKE 'prospect:%:outreach')
      AND EXISTS (SELECT 1 FROM growth_accounts g WHERE g.id=autonomy_tasks.entity_id AND g.updated_at>autonomy_tasks.updated_at)`)
    .bind(now).run();
  counts.prospect = changes(prospect);

  const content = await env.CRM_DB.prepare(`UPDATE autonomy_tasks
    SET unique_key=unique_key || ':state-closed:' || id,updated_at=?
    WHERE action_type='publish_content' AND status IN ${TERMINAL_STATUSES}
      AND unique_key LIKE 'content:%:publish'
      AND EXISTS (SELECT 1 FROM growth_content c WHERE c.id=autonomy_tasks.entity_id AND c.updated_at>autonomy_tasks.updated_at)`)
    .bind(now).run();
  counts.content = changes(content);

  return counts;
}

async function promoteDeferredTasks(env) {
  const global = await env.CRM_DB.prepare("SELECT enabled FROM autonomy_agent_controls WHERE agent_id='__global__'").first();
  if (!global || !Boolean(global.enabled)) return { total: 0, byAgent: {}, disabled: true };
  const controls = await env.CRM_DB.prepare(`SELECT agent_id,enabled,max_tasks_per_run FROM autonomy_agent_controls
    WHERE agent_id<>'__global__' ORDER BY agent_id`).all();
  const byAgent = {};
  let total = 0;

  for (const control of controls.results || []) {
    if (!Boolean(control.enabled)) continue;
    const maxTasks = Math.max(1, Math.min(100, Number(control.max_tasks_per_run || 1)));
    const queued = await env.CRM_DB.prepare("SELECT COUNT(*) count FROM autonomy_tasks WHERE agent=? AND status='queued' AND approval_required=0")
      .bind(control.agent_id).first();
    const slots = Math.max(0, maxTasks - Number(queued?.count || 0));
    if (!slots) continue;
    const deferred = await env.CRM_DB.prepare(`SELECT id FROM autonomy_tasks
      WHERE agent=? AND status='deferred' AND approval_required=0
      ORDER BY priority DESC,created_at ASC LIMIT ?`).bind(control.agent_id, slots).all();
    let promoted = 0;
    for (const task of deferred.results || []) {
      const result = await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='queued',updated_at=? WHERE id=? AND status='deferred'")
        .bind(new Date().toISOString(), task.id).run();
      promoted += changes(result) > 0 ? 1 : 0;
    }
    if (promoted) byAgent[control.agent_id] = promoted;
    total += promoted;
  }
  return { total, byAgent, disabled: false };
}

async function getHardeningSummary(env) {
  const date = saoPauloDate();
  const [deferred, ai, replay] = await Promise.all([
    env.CRM_DB.prepare("SELECT agent,COUNT(*) count FROM autonomy_tasks WHERE status='deferred' GROUP BY agent ORDER BY agent").all(),
    env.CRM_DB.prepare(`SELECT usage_date,agent,model,calls,reserved_tokens,successful_calls,failed_calls,updated_at
      FROM autonomy_ai_daily_usage WHERE usage_date=? ORDER BY agent,model`).bind(date).all(),
    env.CRM_DB.prepare(`SELECT id,dead_letter_id,task_id,agent,action_type,outcome,reason,requested_by,created_at
      FROM autonomy_replay_audit ORDER BY created_at DESC LIMIT ?`).bind(MAX_REPLAY_AUDIT).all(),
  ]);
  return {
    version: AUTONOMY_HARDENING_VERSION,
    queueBudgetEnforced: true,
    deferredByAgent: Object.fromEntries((deferred.results || []).map((row) => [row.agent, Number(row.count || 0)])),
    aiBudgetPolicy: getAiBudgetPolicy(env),
    aiUsageToday: ai.results || [],
    safeReplayActions: SAFE_REPLAY_ACTIONS,
    recentReplayAudit: replay.results || [],
    generatedAt: new Date().toISOString(),
  };
}

async function recordReplayAudit(env, row, outcome, reason) {
  await env.CRM_DB.prepare(`INSERT INTO autonomy_replay_audit
    (id,dead_letter_id,task_id,agent,action_type,outcome,reason,requested_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), row.id, row.task_id, row.agent, row.action_type, outcome, cleanText(reason, 600), 'panel-admin', new Date().toISOString()).run();
}

async function incrementRetryUsage(env, agent) {
  const date = saoPauloDate();
  const now = new Date().toISOString();
  await env.CRM_DB.prepare(`INSERT OR IGNORE INTO autonomy_agent_daily_usage (agent,usage_date,updated_at) VALUES (?,?,?)`)
    .bind(agent || 'unknown', date, now).run();
  await env.CRM_DB.prepare(`UPDATE autonomy_agent_daily_usage SET retries=retries+1,updated_at=? WHERE agent=? AND usage_date=?`)
    .bind(now, agent || 'unknown', date).run();
}

function changes(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function saoPauloDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function saoPauloDayStartIso() {
  return new Date(`${saoPauloDate()}T03:00:00.000Z`).toISOString();
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

function cleanText(value, max = 1000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}
