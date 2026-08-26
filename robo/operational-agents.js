const OPERATIONAL_AGENT_IDS = new Set(['delivery', 'executive']);

export const OPERATIONAL_AGENTS = Object.freeze([
  { id: 'delivery', name: 'Delivery', domain: 'projects', autonomy: 'internal-handoff-shadow', status: 'active-shadow' },
  { id: 'executive', name: 'Executivo', domain: 'executive', autonomy: 'internal-brief-only', status: 'active' },
]);

export async function handleOperationalAgentApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/autonomy/agent-controls') && !url.pathname.startsWith('/crm/autonomy/artifacts')) return null;
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok: false, error: 'autonomy_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/autonomy/agent-controls' && request.method === 'GET') {
    await ensureControls(env);
    return respond({ ok: true, controls: await getControls(env) }, 200, cors);
  }

  if (url.pathname === '/crm/autonomy/agent-controls' && request.method === 'PATCH') {
    const body = await readJson(request);
    const agentId = String(body.agentId || '').trim();
    if (agentId !== '__global__' && !OPERATIONAL_AGENT_IDS.has(agentId)) {
      return respond({ ok: false, error: 'invalid_agent' }, 400, cors);
    }
    await ensureControls(env);
    const current = await env.CRM_DB.prepare('SELECT * FROM autonomy_agent_controls WHERE agent_id=?').bind(agentId).first();
    const enabled = body.enabled == null ? Number(current?.enabled ?? 1) : body.enabled === true ? 1 : 0;
    const shadowMode = body.shadowMode == null ? Number(current?.shadow_mode ?? 0) : body.shadowMode === true ? 1 : 0;
    const maxTasks = clamp(Number(body.maxTasksPerRun ?? current?.max_tasks_per_run ?? 10), 1, 100);
    await env.CRM_DB.prepare(`UPDATE autonomy_agent_controls SET enabled=?,shadow_mode=?,max_tasks_per_run=?,note=?,updated_at=? WHERE agent_id=?`)
      .bind(enabled, shadowMode, maxTasks, cleanText(body.note || current?.note || '', 500), new Date().toISOString(), agentId).run();
    return respond({ ok: true, controls: await getControls(env) }, 200, cors);
  }

  if (url.pathname === '/crm/autonomy/artifacts' && request.method === 'GET') {
    return respond({ ok: true, artifacts: await getArtifacts(env) }, 200, cors);
  }

  return respond({ ok: false, error: 'not_found' }, 404, cors);
}

export async function runOperationalAgents(env, { trigger = 'scheduled_30m' } = {}) {
  if (!env.CRM_DB) return { tasksCreated: 0, tasksExecuted: 0, deliveryHandoffs: 0, executiveBriefs: 0, disabled: true };
  await ensureControls(env);
  const controls = await getControls(env);
  const global = controls.__global__;
  if (!global?.enabled) return { tasksCreated: 0, tasksExecuted: 0, deliveryHandoffs: 0, executiveBriefs: 0, disabled: true, reason: 'global_kill_switch' };

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const stats = { tasksCreated: 0, tasksExecuted: 0, deliveryHandoffs: 0, executiveBriefs: 0 };
  await env.CRM_DB.prepare('INSERT INTO autonomy_runs (id,trigger_type,status,started_at) VALUES (?,?,?,?)')
    .bind(runId, `operational_agents:${trigger}`, 'running', startedAt).run();

  try {
    if (controls.delivery?.enabled) {
      const deliveryCandidates = await discoverDeliveryWork(env, controls.delivery.maxTasksPerRun);
      for (const candidate of deliveryCandidates) if (await enqueueTask(env, candidate, startedAt)) stats.tasksCreated++;
    }

    if (controls.executive?.enabled) {
      const executiveCandidates = await discoverExecutiveWork(env);
      for (const candidate of executiveCandidates) if (await enqueueTask(env, candidate, startedAt)) stats.tasksCreated++;
    }

    const execution = await executeOperationalTasks(env, controls);
    stats.tasksExecuted = execution.executed;
    stats.deliveryHandoffs = execution.deliveryHandoffs;
    stats.executiveBriefs = execution.executiveBriefs;

    const completedAt = new Date().toISOString();
    const summary = {
      ...stats,
      agents: OPERATIONAL_AGENTS.filter((agent) => controls[agent.id]?.enabled).map((agent) => agent.id),
      shadow: Object.fromEntries(OPERATIONAL_AGENTS.map((agent) => [agent.id, Boolean(controls[agent.id]?.shadowMode)])),
    };
    await env.CRM_DB.prepare(`UPDATE autonomy_runs SET status='success',completed_at=?,tasks_created=?,tasks_executed=?,approvals_requested=0,summary_json=? WHERE id=?`)
      .bind(completedAt, stats.tasksCreated, stats.tasksExecuted, JSON.stringify(summary), runId).run();
    return summary;
  } catch (error) {
    await env.CRM_DB.prepare(`UPDATE autonomy_runs SET status='failed',completed_at=?,error_text=? WHERE id=?`)
      .bind(new Date().toISOString(), cleanError(error), runId).run().catch(() => {});
    throw error;
  }
}

export async function enrichAutonomySummaryResponse(response, env) {
  if (!response || !response.ok || !env.CRM_DB) return response;
  try {
    const data = await response.json();
    await ensureControls(env);
    const controls = await getControls(env);
    const byId = new Map((data.agents || []).map((agent) => [agent.id, agent]));
    for (const definition of OPERATIONAL_AGENTS) {
      const control = controls[definition.id] || {};
      byId.set(definition.id, {
        ...(byId.get(definition.id) || {}),
        ...definition,
        status: control.enabled ? (control.shadowMode ? 'active-shadow' : 'active') : 'disabled',
        control: { enabled: Boolean(control.enabled), shadowMode: Boolean(control.shadowMode), maxTasksPerRun: control.maxTasksPerRun || 0 },
      });
    }
    data.agents = [...byId.values()];
    data.agentControls = controls;
    data.operationalArtifacts = await getArtifacts(env);
    data.policy = data.policy || {};
    data.policy.failMode = 'fail_closed';
    data.policy.autoExecute = unique([...(data.policy.autoExecute || []), 'delivery_handoff_draft', 'executive_daily_brief']);
    data.policy.approvalRequired = unique([...(data.policy.approvalRequired || []), 'delivery_external_activation']);
    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    return new Response(JSON.stringify(data), { status: response.status, headers });
  } catch {
    return response;
  }
}

async function discoverDeliveryWork(env, limit) {
  const result = await env.CRM_DB.prepare(`
    SELECT l.id,l.name,l.company,l.segment,l.need,l.owner,l.estimated_value_cents,l.expected_close_date,l.updated_at,
      p.id AS proposal_id,p.status AS proposal_status,p.title AS proposal_title
    FROM leads l
    LEFT JOIN crm_proposals p ON p.id=(SELECT p2.id FROM crm_proposals p2 WHERE p2.lead_id=l.id ORDER BY p2.version DESC LIMIT 1)
    LEFT JOIN delivery_handoffs d ON d.lead_id=l.id
    WHERE l.status='ganho' AND d.id IS NULL
    ORDER BY l.updated_at ASC LIMIT ?`).bind(clamp(limit, 1, 100)).all();
  return (result.results || []).map((lead) => ({
    uniqueKey: `delivery:${lead.id}:handoff-v1`, agent: 'delivery', actionType: 'prepare_delivery_handoff', entityType: 'lead', entityId: lead.id,
    title: `Preparar handoff de delivery: ${lead.company || lead.name || lead.id}`,
    payload: { lead }, risk: 'low', approvalRequired: false, priority: 92,
  }));
}

async function discoverExecutiveWork(env) {
  const date = saoPauloDate();
  const existing = await env.CRM_DB.prepare('SELECT id FROM executive_briefs WHERE brief_date=? LIMIT 1').bind(date).first();
  if (existing) return [];
  return [{
    uniqueKey: `executive:${date}:daily-brief-v1`, agent: 'executive', actionType: 'generate_executive_brief', entityType: 'operation', entityId: date,
    title: `Gerar brief executivo: ${date}`, payload: { briefDate: date }, risk: 'low', approvalRequired: false, priority: 88,
  }];
}

async function enqueueTask(env, item, now) {
  const existing = await env.CRM_DB.prepare('SELECT id FROM autonomy_tasks WHERE unique_key=? LIMIT 1').bind(item.uniqueKey).first();
  if (existing) return false;
  const id = crypto.randomUUID();
  await env.CRM_DB.prepare(`INSERT INTO autonomy_tasks
    (id,unique_key,agent,action_type,entity_type,entity_id,title,payload_json,risk_level,approval_required,status,priority,scheduled_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, item.uniqueKey, item.agent, item.actionType, item.entityType || null, item.entityId || null, item.title,
      JSON.stringify(item.payload || {}).slice(0, 7000), item.risk || 'low', 0, 'queued', item.priority || 50, now, now, now).run();
  await recordDecision(env, id, item.agent, 'task_created', `Agente ${item.agent} identificou trabalho interno seguro.`, 1, 'safe_internal_auto_execute', { actionType: item.actionType });
  return true;
}

async function executeOperationalTasks(env, controls) {
  const result = await env.CRM_DB.prepare("SELECT * FROM autonomy_tasks WHERE status='queued' AND approval_required=0 AND agent IN ('delivery','executive') ORDER BY priority DESC, created_at ASC LIMIT 50").all();
  const counters = { delivery: 0, executive: 0 };
  const stats = { executed: 0, deliveryHandoffs: 0, executiveBriefs: 0 };

  for (const task of result.results || []) {
    const control = controls[task.agent];
    if (!control?.enabled || counters[task.agent] >= Number(control.maxTasksPerRun || 1)) continue;
    counters[task.agent]++;
    const runningAt = new Date().toISOString();
    await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='running',updated_at=? WHERE id=? AND status='queued'").bind(runningAt, task.id).run();
    try {
      const payload = parseJson(task.payload_json);
      let outcome;
      if (task.action_type === 'prepare_delivery_handoff') {
        outcome = await prepareDeliveryHandoff(env, task, payload, Boolean(control.shadowMode));
        stats.deliveryHandoffs++;
      } else if (task.action_type === 'generate_executive_brief') {
        outcome = await generateExecutiveBrief(env, task, payload);
        stats.executiveBriefs++;
      } else {
        throw new Error(`unsupported_operational_action:${task.action_type}`);
      }
      const done = new Date().toISOString();
      await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='completed',completed_at=?,updated_at=?,error_text=NULL WHERE id=?").bind(done, done, task.id).run();
      await recordDecision(env, task.id, task.agent, 'auto_executed', 'Ação estritamente interna executada; nenhum efeito externo foi realizado.', 1, control.shadowMode ? 'shadow_internal_only' : 'safe_internal_auto_execute', outcome);
      stats.executed++;
    } catch (error) {
      const message = cleanError(error);
      await env.CRM_DB.prepare("UPDATE autonomy_tasks SET status='failed',updated_at=?,error_text=? WHERE id=?").bind(new Date().toISOString(), message, task.id).run();
      await recordDecision(env, task.id, task.agent, 'execution_failed', message, 1, 'fail_closed', {});
    }
  }
  return stats;
}

async function prepareDeliveryHandoff(env, task, payload, shadowMode) {
  const leadId = task.entity_id || payload?.lead?.id;
  const lead = await env.CRM_DB.prepare('SELECT id,name,company,segment,need,owner,estimated_value_cents,expected_close_date,status,notes FROM leads WHERE id=?').bind(leadId).first();
  if (!lead || lead.status !== 'ganho') throw new Error('delivery_lead_not_won');
  const proposal = await env.CRM_DB.prepare('SELECT id,version,status,title,executive_summary,scope_json,roadmap_json,risks_json,assumptions_json,discovery_gaps_json FROM crm_proposals WHERE lead_id=? ORDER BY version DESC LIMIT 1').bind(leadId).first();
  const now = new Date().toISOString();
  const summary = {
    mode: shadowMode ? 'shadow' : 'internal',
    lead: { id: lead.id, name: lead.name, company: lead.company, segment: lead.segment, need: lead.need, owner: lead.owner, expectedCloseDate: lead.expected_close_date, estimatedValueCents: lead.estimated_value_cents },
    proposal: proposal ? { id: proposal.id, version: proposal.version, status: proposal.status, title: proposal.title, executiveSummary: proposal.executive_summary, scope: parseJson(proposal.scope_json), roadmap: parseJson(proposal.roadmap_json), risks: parseJson(proposal.risks_json), assumptions: parseJson(proposal.assumptions_json), discoveryGaps: parseJson(proposal.discovery_gaps_json) } : null,
    checklist: ['Confirmar responsável de delivery','Validar escopo contratado','Converter roadmap comercial em backlog inicial','Registrar riscos e premissas','Preparar kickoff interno','Aguardar aprovação humana antes de qualquer compromisso externo'],
    externalActionsExecuted: false,
  };
  const id = crypto.randomUUID();
  await env.CRM_DB.prepare(`INSERT OR IGNORE INTO delivery_handoffs (id,lead_id,proposal_id,status,summary_json,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(id, leadId, proposal?.id || null, 'draft', JSON.stringify(summary).slice(0, 20000), 'delivery-agent', now, now).run();

  if (!shadowMode) {
    const taskId = crypto.randomUUID();
    await env.CRM_DB.prepare(`INSERT INTO crm_tasks (id,lead_id,title,due_at,status,owner,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(taskId, leadId, `Revisar handoff de delivery: ${lead.company || lead.name}`, addHours(now, 24), 'aberta', lead.owner || null, now).run();
  }
  return { handoffId: id, leadId, proposalId: proposal?.id || null, shadowMode, externalActionsExecuted: false };
}

async function generateExecutiveBrief(env, task, payload) {
  const date = payload.briefDate || saoPauloDate();
  const [leads, proposals, approvals, growth, alerts, delivery, recentRuns] = await Promise.all([
    env.CRM_DB.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN status NOT IN ('ganho','perdido','arquivado') THEN 1 ELSE 0 END) open,
      SUM(CASE WHEN status NOT IN ('ganho','perdido','arquivado') AND (temperature='quente' OR score>=75) THEN 1 ELSE 0 END) hot,
      SUM(CASE WHEN status='ganho' THEN 1 ELSE 0 END) won
      FROM leads`).first(),
    env.CRM_DB.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN status IN ('draft','pending_approval') THEN 1 ELSE 0 END) pending,
      SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) approved,
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) sent FROM crm_proposals`).first(),
    env.CRM_DB.prepare("SELECT COUNT(*) count FROM autonomy_approvals WHERE status='pending'").first(),
    env.CRM_DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN score>=75 THEN 1 ELSE 0 END) high_intent FROM growth_accounts").first(),
    env.CRM_DB.prepare("SELECT COUNT(*) open,SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) critical FROM crm_alerts WHERE status='open'").first(),
    env.CRM_DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) draft FROM delivery_handoffs").first(),
    env.CRM_DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed FROM autonomy_runs WHERE started_at>=datetime('now','-1 day')").first(),
  ]);

  const metrics = {
    leads: normalizeCounts(leads), proposals: normalizeCounts(proposals), pendingApprovals: Number(approvals?.count || 0),
    growth: normalizeCounts(growth), alerts: normalizeCounts(alerts), delivery: normalizeCounts(delivery), autonomousRuns24h: normalizeCounts(recentRuns),
  };
  const priorities = [];
  if (metrics.alerts.critical > 0) priorities.push(`${metrics.alerts.critical} alerta(s) crítico(s) exigem atenção.`);
  if (metrics.pendingApprovals > 0) priorities.push(`${metrics.pendingApprovals} ação(ões) aguardando aprovação humana.`);
  if (metrics.leads.hot > 0) priorities.push(`${metrics.leads.hot} lead(s) quente(s) devem permanecer com próxima ação definida.`);
  if (metrics.delivery.draft > 0) priorities.push(`${metrics.delivery.draft} handoff(s) de delivery estão em rascunho para revisão.`);
  if (metrics.autonomousRuns24h.failed > 0) priorities.push(`${metrics.autonomousRuns24h.failed} ciclo(s) autônomo(s) falharam nas últimas 24h.`);
  if (!priorities.length) priorities.push('Operação sem anomalia crítica detectada neste brief.');

  const summary = { briefDate: date, generatedAt: new Date().toISOString(), metrics, priorities, externalActionsExecuted: false };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.CRM_DB.prepare(`INSERT OR IGNORE INTO executive_briefs (id,brief_date,status,summary_json,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(id, date, 'ready', JSON.stringify(summary), 'executive-agent', now, now).run();
  return { briefId: id, briefDate: date, priorities: priorities.length, externalActionsExecuted: false };
}

async function getArtifacts(env) {
  const brief = await env.CRM_DB.prepare('SELECT id,brief_date,status,summary_json,created_at,updated_at FROM executive_briefs ORDER BY brief_date DESC LIMIT 1').first().catch(() => null);
  const handoffs = await env.CRM_DB.prepare('SELECT id,lead_id,proposal_id,status,summary_json,created_at,updated_at FROM delivery_handoffs ORDER BY updated_at DESC LIMIT 10').all().catch(() => ({ results: [] }));
  return {
    latestExecutiveBrief: brief ? { id: brief.id, briefDate: brief.brief_date, status: brief.status, summary: parseJson(brief.summary_json), createdAt: brief.created_at, updatedAt: brief.updated_at } : null,
    recentDeliveryHandoffs: (handoffs.results || []).map((row) => ({ id: row.id, leadId: row.lead_id, proposalId: row.proposal_id, status: row.status, summary: parseJson(row.summary_json), createdAt: row.created_at, updatedAt: row.updated_at })),
  };
}

async function ensureControls(env) {
  const now = new Date().toISOString();
  const defaults = [
    ['__global__', 1, 0, 50, 'Kill switch global do Autonomous OS'],
    ['delivery', 1, 1, 10, 'Delivery Agent em shadow; apenas handoff interno'],
    ['executive', 1, 0, 2, 'Executive Agent; somente brief interno'],
  ];
  for (const row of defaults) {
    await env.CRM_DB.prepare(`INSERT OR IGNORE INTO autonomy_agent_controls (agent_id,enabled,shadow_mode,max_tasks_per_run,note,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind(...row, now).run();
  }
}

async function getControls(env) {
  const result = await env.CRM_DB.prepare('SELECT agent_id,enabled,shadow_mode,max_tasks_per_run,note,updated_at FROM autonomy_agent_controls ORDER BY agent_id').all();
  const out = {};
  for (const row of result.results || []) out[row.agent_id] = { agentId: row.agent_id, enabled: Number(row.enabled) === 1, shadowMode: Number(row.shadow_mode) === 1, maxTasksPerRun: Number(row.max_tasks_per_run || 1), note: row.note || '', updatedAt: row.updated_at };
  return out;
}

async function recordDecision(env, taskId, agent, type, rationale, confidence, policy, data) {
  await env.CRM_DB.prepare(`INSERT INTO autonomy_decisions (id,task_id,agent,decision_type,rationale,confidence,policy,decision_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), taskId || null, agent, type, cleanText(rationale, 1000), confidence, policy, JSON.stringify(data || {}).slice(0, 7000), new Date().toISOString()).run();
}

function authorizeAdmin(request, env) {
  const expected = String(env.CRM_ADMIN_KEY || '');
  if (!expected) return false;
  const provided = request.headers.get('x-crm-key') || String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return constantTimeEqual(provided, expected);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = ['https://www.codesolution.com.br', 'https://codesolution.com.br'];
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (allowed.includes(origin)) { headers['access-control-allow-origin'] = origin; headers.vary = 'Origin'; headers['access-control-allow-headers'] = 'content-type,x-crm-key,authorization'; headers['access-control-allow-methods'] = 'GET,POST,PATCH,OPTIONS'; }
  return headers;
}
function respond(data, status, headers) { return new Response(JSON.stringify(data), { status, headers }); }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function parseJson(value) { try { return typeof value === 'string' ? JSON.parse(value || '{}') : (value || {}); } catch { return {}; } }
function normalizeCounts(row) { return Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, Number(v || 0)])); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function clamp(value, min, max) { const n = Number.isFinite(value) ? value : min; return Math.max(min, Math.min(max, Math.round(n))); }
function cleanText(value, max) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanError(error) { return cleanText(error?.message || error || 'unknown_error', 1200); }
function saoPauloDate() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } }
function addHours(iso, hours) { return new Date(Date.parse(iso) + hours * 3600000).toISOString(); }
async function sha256Hex(value) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))); return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function constantTimeEqual(a, b) { const x = String(a || ''), y = String(b || ''); let diff = x.length ^ y.length; const len = Math.max(x.length, y.length); for (let i = 0; i < len; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0); return diff === 0; }
