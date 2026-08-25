const CLOSED_LEAD_STATUSES = new Set(['ganho', 'perdido', 'arquivado']);

export const AUTONOMY_AGENTS = Object.freeze([
  { id: 'orchestrator', name: 'Orquestrador', domain: 'operations', autonomy: 'high', status: 'active' },
  { id: 'sales_ops', name: 'Sales Ops', domain: 'commercial', autonomy: 'high-internal', status: 'active' },
  { id: 'prospecting', name: 'Prospecção B2B', domain: 'growth', autonomy: 'prepare-only-external', status: 'active' },
  { id: 'content', name: 'Conteúdo & Demanda', domain: 'marketing', autonomy: 'prepare-only-external', status: 'active' },
  { id: 'reliability', name: 'Confiabilidade', domain: 'production', autonomy: 'monitor-and-alert', status: 'active-external-watch' },
  { id: 'proposal', name: 'Propostas', domain: 'commercial', autonomy: 'approval-required', status: 'planned' },
  { id: 'delivery', name: 'Delivery', domain: 'projects', autonomy: 'approval-required', status: 'planned' },
]);

export async function handleAutonomyApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/autonomy')) return null;
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok: false, error: 'autonomy_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/autonomy/summary' && request.method === 'GET') return autonomySummary(env, cors);
  if (url.pathname === '/crm/autonomy/tasks' && request.method === 'GET') return listTasks(request, env, cors);
  if (url.pathname === '/crm/autonomy/approvals' && request.method === 'GET') return listApprovals(request, env, cors);
  if (url.pathname === '/crm/autonomy/run' && request.method === 'POST') {
    const result = await runAutonomousOrchestrator(env, { trigger: 'manual' });
    return respond({ ok: true, ...result }, 200, cors);
  }
  if (/^\/crm\/autonomy\/approval\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') {
    return patchApproval(request, env, cors);
  }
  return respond({ ok: false, error: 'not_found' }, 404, cors);
}

export async function runAutonomousOrchestrator(env, { trigger = 'scheduled_30m' } = {}) {
  if (!env.CRM_DB) return { tasksCreated: 0, tasksExecuted: 0, approvalsRequested: 0 };
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const stats = { tasksCreated: 0, tasksExecuted: 0, approvalsRequested: 0 };
  await env.CRM_DB.prepare('INSERT INTO autonomy_runs (id,trigger_type,status,started_at) VALUES (?,?,?,?)')
    .bind(runId, trigger, 'running', startedAt).run();

  try {
    const candidates = await discoverWork(env);
    for (const candidate of candidates) {
      const created = await enqueueTask(env, candidate, startedAt);
      if (created) {
        stats.tasksCreated++;
        if (candidate.approvalRequired) stats.approvalsRequested++;
      }
    }
    stats.tasksExecuted = await executeSafeTasks(env);
    const completedAt = new Date().toISOString();
    const summary = { ...stats, candidates: candidates.length, agents: AUTONOMY_AGENTS.filter((a) => a.status.startsWith('active')).map((a) => a.id) };
    await env.CRM_DB.prepare(`UPDATE autonomy_runs SET status='success',completed_at=?,tasks_created=?,tasks_executed=?,approvals_requested=?,summary_json=? WHERE id=?`)
      .bind(completedAt, stats.tasksCreated, stats.tasksExecuted, stats.approvalsRequested, JSON.stringify(summary), runId).run();
    return summary;
  } catch (error) {
    await env.CRM_DB.prepare(`UPDATE autonomy_runs SET status='failed',completed_at=?,error_text=? WHERE id=?`)
      .bind(new Date().toISOString(), cleanError(error), runId).run().catch(() => {});
    throw error;
  }
}

async function discoverWork(env) {
  const [alertsResult, leadsResult, accountsResult, contentResult] = await Promise.all([
    env.CRM_DB.prepare("SELECT id,lead_id,alert_type,severity,title,detail,owner,due_at FROM crm_alerts WHERE status='open' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at ASC LIMIT 100").all(),
    env.CRM_DB.prepare("SELECT id,name,company,status,score,temperature,owner,next_action,next_action_due FROM leads WHERE status NOT IN ('ganho','perdido','arquivado') AND (temperature='quente' OR score>=75) ORDER BY score DESC, created_at ASC LIMIT 100").all(),
    env.CRM_DB.prepare("SELECT id,company,segment,score,priority,status,outreach_angle,suggested_message,source_url FROM growth_accounts WHERE score>=75 AND status IN ('novo','qualificar') ORDER BY score DESC, updated_at ASC LIMIT 100").all(),
    env.CRM_DB.prepare("SELECT id,channel,title,body,cta,status,scheduled_for FROM growth_content WHERE status='pronto' ORDER BY created_at ASC LIMIT 100").all(),
  ]);
  const work = [];

  for (const alert of alertsResult.results || []) {
    if (!alert.lead_id) continue;
    work.push({
      uniqueKey: `crm-alert:${alert.id}`,
      agent: 'sales_ops', actionType: 'ensure_sales_action', entityType: 'lead', entityId: alert.lead_id,
      title: `Tratar alerta comercial: ${alert.title}`,
      payload: { alertId: alert.id, leadId: alert.lead_id, owner: alert.owner, dueAt: alert.due_at, severity: alert.severity, detail: alert.detail },
      risk: 'low', approvalRequired: false, priority: alert.severity === 'critical' ? 100 : 85,
    });
  }

  for (const lead of leadsResult.results || []) {
    if (CLOSED_LEAD_STATUSES.has(lead.status)) continue;
    const due = lead.next_action_due ? Date.parse(lead.next_action_due) : 0;
    const missingOrLate = !lead.next_action || !due || due < Date.now();
    if (!missingOrLate) continue;
    work.push({
      uniqueKey: `hot-lead:${lead.id}:priority`,
      agent: 'sales_ops', actionType: 'prioritize_hot_lead', entityType: 'lead', entityId: lead.id,
      title: `Priorizar lead quente: ${lead.company || lead.name || lead.id}`,
      payload: { leadId: lead.id, owner: lead.owner, score: lead.score, temperature: lead.temperature },
      risk: 'low', approvalRequired: false, priority: 100,
    });
  }

  for (const account of accountsResult.results || []) {
    if (account.status === 'novo') {
      work.push({
        uniqueKey: `prospect:${account.id}:qualify`,
        agent: 'prospecting', actionType: 'qualify_prospect', entityType: 'growth_account', entityId: account.id,
        title: `Qualificar prospect: ${account.company}`,
        payload: { accountId: account.id, company: account.company, score: account.score, sourceUrl: account.source_url },
        risk: 'low', approvalRequired: false, priority: Math.max(70, Number(account.score || 0)),
      });
    } else if (Number(account.score || 0) >= 80) {
      work.push({
        uniqueKey: `prospect:${account.id}:outreach`,
        agent: 'prospecting', actionType: 'external_outreach', entityType: 'growth_account', entityId: account.id,
        title: `Aprovar abordagem para ${account.company}`,
        payload: { accountId: account.id, company: account.company, score: account.score, angle: account.outreach_angle, suggestedMessage: account.suggested_message, sourceUrl: account.source_url },
        risk: 'high', approvalRequired: true, priority: Number(account.score || 80),
      });
    }
  }

  for (const content of contentResult.results || []) {
    work.push({
      uniqueKey: `content:${content.id}:publish`,
      agent: 'content', actionType: 'publish_content', entityType: 'growth_content', entityId: content.id,
      title: `Aprovar publicação: ${content.title || content.channel}`,
      payload: { contentId: content.id, channel: content.channel, title: content.title, scheduledFor: content.scheduled_for, cta: content.cta },
      risk: 'high', approvalRequired: true, priority: content.scheduled_for ? 85 : 70,
    });
  }
  return work;
}

async function enqueueTask(env, item, now) {
  const existing = await env.CRM_DB.prepare('SELECT id FROM autonomy_tasks WHERE unique_key=? LIMIT 1').bind(item.uniqueKey).first();
  if (existing) return false;
  const id = crypto.randomUUID();
  const status = item.approvalRequired ? 'waiting_approval' : 'queued';
  await env.CRM_DB.prepare(`INSERT INTO autonomy_tasks
    (id,unique_key,agent,action_type,entity_type,entity_id,title,payload_json,risk_level,approval_required,status,priority,scheduled_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, item.uniqueKey, item.agent, item.actionType, item.entityType || null, item.entityId || null, item.title,
      JSON.stringify(item.payload || {}).slice(0, 7000), item.risk, item.approvalRequired ? 1 : 0, status, item.priority || 50, now, now, now).run();
  await recordDecision(env, id, item.agent, 'task_created', `Orquestrador identificou trabalho ${item.actionType}.`, 1, item.approvalRequired ? 'external_requires_human_approval' : 'safe_internal_auto_execute', { risk: item.risk });
  if (item.approvalRequired) {
    await env.CRM_DB.prepare('INSERT OR IGNORE INTO autonomy_approvals (id,task_id,status,requested_by,created_at) VALUES (?,?,?,?,?)')
      .bind(crypto.randomUUID(), id, 'pending', item.agent, now).run();
  }
  return true;
}

async function executeSafeTasks(env) {
  const result = await env.CRM_DB.prepare("SELECT * FROM autonomy_tasks WHERE status='queued' AND approval_required=0 ORDER BY priority DESC, created_at ASC LIMIT 50").all();
  let executed = 0;
  for (const task of result.results || []) {
    const now = new Date().toISOString();
    await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='running',updated_at=? WHERE id=? AND status='queued'").bind(now, task.id).run();
    try {
      const payload = parseJson(task.payload_json);
      let outcome = {};
      if (task.action_type === 'qualify_prospect') outcome = await qualifyProspect(env, task, payload);
      else if (task.action_type === 'prioritize_hot_lead') outcome = await ensureLeadTask(env, task, payload, true);
      else if (task.action_type === 'ensure_sales_action') outcome = await ensureLeadTask(env, task, payload, false);
      else throw new Error(`unsupported_safe_action:${task.action_type}`);
      const done = new Date().toISOString();
      await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='completed',completed_at=?,updated_at=?,error_text=NULL WHERE id=?")
        .bind(done, done, task.id).run();
      await recordDecision(env, task.id, task.agent, 'auto_executed', 'Ação interna de baixo risco executada automaticamente.', 1, 'safe_internal_auto_execute', outcome);
      executed++;
    } catch (error) {
      await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='failed',updated_at=?,error_text=? WHERE id=?")
        .bind(new Date().toISOString(), cleanError(error), task.id).run();
      await recordDecision(env, task.id, task.agent, 'execution_failed', cleanError(error), 1, 'fail_closed', {});
    }
  }
  return executed;
}

async function qualifyProspect(env, task, payload) {
  const id = payload.accountId || task.entity_id;
  const current = await env.CRM_DB.prepare('SELECT id,status,company,score FROM growth_accounts WHERE id=?').bind(id).first();
  if (!current) throw new Error('growth_account_not_found');
  if (current.status === 'novo') {
    await env.CRM_DB.prepare("UPDATE growth_accounts SET status='qualificar',updated_at=? WHERE id=?")
      .bind(new Date().toISOString(), id).run();
  }
  return { accountId: id, previousStatus: current.status, currentStatus: current.status === 'novo' ? 'qualificar' : current.status };
}

async function ensureLeadTask(env, task, payload, urgent) {
  const leadId = payload.leadId || task.entity_id;
  const lead = await env.CRM_DB.prepare('SELECT id,name,company,owner FROM leads WHERE id=?').bind(leadId).first();
  if (!lead) throw new Error('lead_not_found');
  const existing = await env.CRM_DB.prepare("SELECT id,title,due_at FROM crm_tasks WHERE lead_id=? AND status='aberta' ORDER BY due_at ASC LIMIT 1").bind(leadId).first();
  if (existing) return { leadId, crmTaskId: existing.id, reused: true };
  const now = new Date();
  const dueAt = new Date(now.getTime() + (urgent ? 15 : 60) * 60 * 1000).toISOString();
  const crmTaskId = `autonomy:${task.id}`;
  const title = urgent ? 'Contato prioritário com lead quente' : `Tratar alerta comercial: ${task.title.replace(/^Tratar alerta comercial:\s*/i, '')}`;
  await env.CRM_DB.prepare('INSERT INTO crm_tasks (id,lead_id,title,due_at,status,owner,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(crmTaskId, leadId, title.slice(0, 240), dueAt, 'aberta', lead.owner || payload.owner || 'Comercial', now.toISOString()).run();
  await env.CRM_DB.prepare('INSERT INTO crm_audit_log (id,lead_id,action,actor,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), leadId, 'autonomy_task_created', task.agent, null, JSON.stringify({ crmTaskId, title, dueAt }), now.toISOString()).run();
  return { leadId, crmTaskId, dueAt, reused: false };
}

async function patchApproval(request, env, cors) {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const body = await readJson(request);
  const decision = String(body.decision || body.status || '').toLowerCase();
  if (!['approved', 'rejected'].includes(decision)) return respond({ ok: false, error: 'invalid_decision' }, 400, cors);
  const approval = await env.CRM_DB.prepare('SELECT * FROM autonomy_approvals WHERE id=?').bind(id).first();
  if (!approval) return respond({ ok: false, error: 'not_found' }, 404, cors);
  if (approval.status !== 'pending') return respond({ ok: false, error: 'approval_already_decided' }, 409, cors);
  const now = new Date().toISOString();
  const note = clean(body.note, 1200);
  await env.CRM_DB.prepare('UPDATE autonomy_approvals SET status=?,decided_by=?,note=?,decided_at=? WHERE id=?')
    .bind(decision, 'panel-admin', note || null, now, id).run();
  await env.CRM_DB.prepare('UPDATE autonomy_tasks SET status=?,updated_at=? WHERE id=?')
    .bind(decision, now, approval.task_id).run();
  const task = await env.CRM_DB.prepare('SELECT * FROM autonomy_tasks WHERE id=?').bind(approval.task_id).first();
  await recordDecision(env, approval.task_id, task?.agent || 'orchestrator', `human_${decision}`, note || `Ação ${decision} pelo administrador.`, 1, 'human_gate', { approvalId: id });
  return respond({ ok: true, approval: { ...approval, status: decision, decidedAt: now }, taskStatus: decision }, 200, cors);
}

async function autonomySummary(env, cors) {
  const [goals, taskCounts, pending, runs, tasks] = await Promise.all([
    env.CRM_DB.prepare("SELECT goal_key,name,domain,target_json,status,priority FROM autonomy_goals WHERE status='active' ORDER BY priority DESC").all(),
    env.CRM_DB.prepare('SELECT status,COUNT(*) count FROM autonomy_tasks GROUP BY status').all(),
    env.CRM_DB.prepare("SELECT a.id approval_id,a.task_id,a.created_at,t.agent,t.action_type,t.entity_type,t.entity_id,t.title,t.risk_level,t.priority,t.payload_json FROM autonomy_approvals a JOIN autonomy_tasks t ON t.id=a.task_id WHERE a.status='pending' ORDER BY t.priority DESC,a.created_at ASC LIMIT 100").all(),
    env.CRM_DB.prepare('SELECT * FROM autonomy_runs ORDER BY started_at DESC LIMIT 12').all(),
    env.CRM_DB.prepare("SELECT id,agent,action_type,entity_type,entity_id,title,risk_level,approval_required,status,priority,created_at,updated_at,completed_at,error_text FROM autonomy_tasks ORDER BY created_at DESC LIMIT 30").all(),
  ]);
  return respond({
    ok: true,
    agents: AUTONOMY_AGENTS,
    goals: (goals.results || []).map((x) => ({ ...x, target: parseJson(x.target_json) })),
    taskCounts: Object.fromEntries((taskCounts.results || []).map((x) => [x.status, Number(x.count || 0)])),
    pendingApprovals: (pending.results || []).map(mapApprovalRow),
    recentRuns: runs.results || [],
    recentTasks: tasks.results || [],
    policy: {
      autoExecute: ['internal_crm_task', 'internal_prospect_qualification', 'monitoring', 'analytics'],
      approvalRequired: ['external_message', 'content_publish', 'proposal_send', 'discount', 'financial_commitment', 'destructive_change'],
      failMode: 'fail_closed',
    },
    generatedAt: new Date().toISOString(),
  }, 200, cors);
}

async function listTasks(request, env, cors) {
  const url = new URL(request.url);
  const status = clean(url.searchParams.get('status'), 30);
  const agent = clean(url.searchParams.get('agent'), 60);
  const limit = clamp(url.searchParams.get('limit'), 100);
  let sql = 'SELECT * FROM autonomy_tasks WHERE 1=1';
  const bindings = [];
  if (status) { sql += ' AND status=?'; bindings.push(status); }
  if (agent) { sql += ' AND agent=?'; bindings.push(agent); }
  sql += ' ORDER BY priority DESC,created_at DESC LIMIT ?'; bindings.push(limit);
  const result = await env.CRM_DB.prepare(sql).bind(...bindings).all();
  return respond({ ok: true, tasks: (result.results || []).map((x) => ({ ...x, payload: parseJson(x.payload_json) })) }, 200, cors);
}

async function listApprovals(request, env, cors) {
  const url = new URL(request.url);
  const status = clean(url.searchParams.get('status'), 30) || 'pending';
  const limit = clamp(url.searchParams.get('limit'), 100);
  const result = await env.CRM_DB.prepare(`SELECT a.id approval_id,a.task_id,a.status approval_status,a.requested_by,a.decided_by,a.note,a.created_at,a.decided_at,
    t.agent,t.action_type,t.entity_type,t.entity_id,t.title,t.risk_level,t.priority,t.payload_json
    FROM autonomy_approvals a JOIN autonomy_tasks t ON t.id=a.task_id WHERE a.status=? ORDER BY t.priority DESC,a.created_at ASC LIMIT ?`)
    .bind(status, limit).all();
  return respond({ ok: true, approvals: (result.results || []).map(mapApprovalRow) }, 200, cors);
}

async function recordDecision(env, taskId, agent, type, rationale, confidence, policy, data) {
  await env.CRM_DB.prepare('INSERT INTO autonomy_decisions (id,task_id,agent,decision_type,rationale,confidence,policy,decision_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), taskId || null, agent, type, clean(rationale, 1600) || null, confidence ?? null, policy || null, JSON.stringify(data || {}).slice(0, 7000), new Date().toISOString()).run();
}

function mapApprovalRow(x) {
  return {
    id: x.approval_id, taskId: x.task_id, status: x.approval_status || 'pending', requestedBy: x.requested_by,
    decidedBy: x.decided_by, note: x.note, createdAt: x.created_at, decidedAt: x.decided_at,
    task: { agent: x.agent, actionType: x.action_type, entityType: x.entity_type, entityId: x.entity_id, title: x.title, riskLevel: x.risk_level, priority: x.priority, payload: parseJson(x.payload_json) },
  };
}

function authorizeAdmin(request, env) {
  const expected = env.CRM_ADMIN_KEY || '';
  if (!expected) return false;
  const provided = request.headers.get('x-crm-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return safeEqual(provided, expected);
}
function safeEqual(a, b) { if (!a || !b || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function parseJson(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function clean(value, max = 500) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function clamp(value, fallback = 100) { return Math.min(Math.max(Number(value || fallback), 1), 250); }
function cleanError(error) { return String(error?.message || error).replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]').slice(0, 900); }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function respond(data, status, cors) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }); }
function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || 'https://www.codesolution.com.br,https://codesolution.com.br').split(',').map((x) => x.trim()).filter(Boolean);
  const accepted = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'access-control-allow-origin': accepted,
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type,x-crm-key,authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
