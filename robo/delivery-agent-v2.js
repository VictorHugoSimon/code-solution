export const DELIVERY_AGENT_V2 = Object.freeze({
  id: 'delivery-v2',
  name: 'Delivery v2',
  domain: 'projects',
  autonomy: 'internal-project-shadow',
  status: 'active-shadow',
});

const MAX_PROJECTS_PER_RUN = 20;
const BACKLOG_TYPES = new Set(['epic', 'story', 'task']);
const BACKLOG_STATUSES = new Set(['backlog', 'ready', 'doing', 'blocked', 'done', 'cancelled']);
const INCIDENT_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const INCIDENT_STATUSES = new Set(['open', 'investigating', 'mitigated', 'resolved', 'closed']);

export async function handleDeliveryAgentV2Api(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/autonomy/delivery')) return null;
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok: false, error: 'delivery_db_not_configured' }, 503, cors);

  try {
    if (url.pathname === '/crm/autonomy/delivery/summary' && request.method === 'GET') {
      return respond({ ok: true, ...(await getDeliverySummary(env)) }, 200, cors);
    }
    if (url.pathname === '/crm/autonomy/delivery/projects' && request.method === 'GET') {
      const projects = await listProjects(env, clamp(Number(url.searchParams.get('limit') || 100), 1, 250));
      return respond({ ok: true, projects }, 200, cors);
    }
    if (url.pathname === '/crm/autonomy/delivery/run' && request.method === 'POST') {
      return respond({ ok: true, ...(await runDeliveryAgentV2(env, { trigger: 'manual' })) }, 200, cors);
    }

    const projectMatch = url.pathname.match(/^\/crm\/autonomy\/delivery\/project\/([^/]+)$/);
    if (projectMatch && request.method === 'GET') {
      const project = await getProjectDetail(env, decodeURIComponent(projectMatch[1]));
      return project ? respond({ ok: true, project }, 200, cors) : respond({ ok: false, error: 'project_not_found' }, 404, cors);
    }

    const reportMatch = url.pathname.match(/^\/crm\/autonomy\/delivery\/project\/([^/]+)\/report$/);
    if (reportMatch && request.method === 'POST') {
      const result = await generateStatusReport(env, decodeURIComponent(reportMatch[1]), { force: true });
      return respond({ ok: true, ...result }, 200, cors);
    }

    const releaseMatch = url.pathname.match(/^\/crm\/autonomy\/delivery\/project\/([^/]+)\/release-notes$/);
    if (releaseMatch && request.method === 'POST') {
      const result = await generateReleaseNotes(env, decodeURIComponent(releaseMatch[1]));
      return respond({ ok: true, ...result }, 200, cors);
    }

    const incidentCreateMatch = url.pathname.match(/^\/crm\/autonomy\/delivery\/project\/([^/]+)\/incident$/);
    if (incidentCreateMatch && request.method === 'POST') {
      const body = await readJson(request);
      const incident = await createIncident(env, decodeURIComponent(incidentCreateMatch[1]), body);
      return respond({ ok: true, incident }, 201, cors);
    }

    const backlogMatch = url.pathname.match(/^\/crm\/autonomy\/delivery\/backlog\/([^/]+)$/);
    if (backlogMatch && request.method === 'PATCH') {
      const body = await readJson(request);
      const item = await updateBacklogItem(env, decodeURIComponent(backlogMatch[1]), body);
      return item ? respond({ ok: true, item }, 200, cors) : respond({ ok: false, error: 'backlog_item_not_found' }, 404, cors);
    }

    const incidentMatch = url.pathname.match(/^\/crm\/autonomy\/delivery\/incident\/([^/]+)$/);
    if (incidentMatch && request.method === 'PATCH') {
      const body = await readJson(request);
      const incident = await updateIncident(env, decodeURIComponent(incidentMatch[1]), body);
      return incident ? respond({ ok: true, incident }, 200, cors) : respond({ ok: false, error: 'incident_not_found' }, 404, cors);
    }

    return respond({ ok: false, error: 'not_found' }, 404, cors);
  } catch (error) {
    return respond({ ok: false, error: 'delivery_v2_failed', detail: cleanError(error) }, 500, cors);
  }
}

export async function runDeliveryAgentV2(env, { trigger = 'scheduled_30m' } = {}) {
  if (!env?.CRM_DB) return { disabled: true, reason: 'db_not_configured' };
  const global = await getControl(env, '__global__');
  const delivery = await getControl(env, 'delivery');
  if (global && !global.enabled) return { disabled: true, reason: 'global_kill_switch' };
  if (delivery && !delivery.enabled) return { disabled: true, reason: 'delivery_disabled' };

  const shadowMode = delivery ? Boolean(delivery.shadowMode) : true;
  const stats = { trigger, shadowMode, projectsCreated: 0, backlogSeeded: 0, reportsGenerated: 0, externalActionsExecuted: false };

  const candidates = await env.CRM_DB.prepare(`
    SELECT d.id AS handoff_id,d.lead_id,d.proposal_id,d.summary_json,d.created_at,d.updated_at,
           l.name,l.company,l.owner,l.need,l.expected_close_date,l.status AS lead_status
    FROM delivery_handoffs d
    JOIN leads l ON l.id=d.lead_id
    LEFT JOIN delivery_projects p ON p.lead_id=d.lead_id
    WHERE l.status='ganho' AND p.id IS NULL
    ORDER BY d.created_at ASC LIMIT ?`).bind(MAX_PROJECTS_PER_RUN).all();

  for (const row of candidates.results || []) {
    const project = await createProjectFromHandoff(env, row, shadowMode);
    if (!project) continue;
    stats.projectsCreated++;
    stats.backlogSeeded += await seedBacklog(env, project.id, parseJson(row.summary_json), row.owner || null);
  }

  const active = await env.CRM_DB.prepare("SELECT id FROM delivery_projects WHERE status NOT IN ('closed','cancelled') ORDER BY updated_at DESC LIMIT 100").all();
  for (const row of active.results || []) {
    const result = await generateStatusReport(env, row.id, { force: false });
    if (result.created) stats.reportsGenerated++;
  }

  return stats;
}

async function createProjectFromHandoff(env, row, shadowMode) {
  const now = new Date().toISOString();
  const summary = parseJson(row.summary_json);
  const proposal = summary?.proposal || {};
  const lead = summary?.lead || {};
  const id = crypto.randomUUID();
  const name = cleanText(row.company || lead.company || row.name || lead.name || `Projeto ${row.lead_id}`, 180);
  const scope = normalizeArray(proposal.scope || summary.scope);
  const risks = normalizeArray(proposal.risks || summary.risks);
  const assumptions = normalizeArray(proposal.assumptions || summary.assumptions).concat(normalizeArray(proposal.discoveryGaps).map((x) => `Lacuna: ${stringifyItem(x)}`));
  const status = shadowMode ? 'shadow_draft' : 'draft';
  await env.CRM_DB.prepare(`INSERT OR IGNORE INTO delivery_projects
    (id,lead_id,handoff_id,proposal_id,name,status,health,owner,target_date,scope_json,risks_json,assumptions_json,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, row.lead_id, row.handoff_id, row.proposal_id || null, name, status, 'unknown', row.owner || lead.owner || null,
      row.expected_close_date || lead.expectedCloseDate || null, JSON.stringify(scope), JSON.stringify(risks), JSON.stringify(assumptions), 'delivery-agent-v2', now, now).run();
  return env.CRM_DB.prepare('SELECT * FROM delivery_projects WHERE lead_id=?').bind(row.lead_id).first();
}

async function seedBacklog(env, projectId, summary, owner) {
  const existing = await env.CRM_DB.prepare('SELECT COUNT(*) count FROM delivery_backlog_items WHERE project_id=?').bind(projectId).first();
  if (Number(existing?.count || 0) > 0) return 0;
  const now = new Date().toISOString();
  const proposal = summary?.proposal || {};
  const roadmap = normalizeArray(proposal.roadmap || summary?.roadmap).slice(0, 10);
  const created = [];

  const kickoffEpic = crypto.randomUUID();
  created.push(item(kickoffEpic, projectId, null, 'epic', 'Kickoff e alinhamento de escopo', 'Consolidar contexto comercial em plano interno revisável.', 100, owner, null, 'medium', 'handoff:kickoff', 10, now));
  created.push(item(crypto.randomUUID(), projectId, kickoffEpic, 'story', 'Validar escopo contratado', 'Confirmar escopo, fora de escopo, premissas e lacunas antes do kickoff externo.', 100, owner, addDays(now, 1), 'medium', 'handoff:scope', 11, now));
  created.push(item(crypto.randomUUID(), projectId, kickoffEpic, 'task', 'Confirmar owner e stakeholders', 'Definir responsável de delivery e stakeholders internos; nenhuma comunicação externa é automática.', 95, owner, addDays(now, 1), 'low', 'handoff:owner', 12, now));
  created.push(item(crypto.randomUUID(), projectId, kickoffEpic, 'task', 'Revisar riscos e premissas', 'Converter riscos comerciais em riscos operacionais verificáveis.', 90, owner, addDays(now, 2), 'medium', 'handoff:risks', 13, now));

  const deliveryEpic = crypto.randomUUID();
  created.push(item(deliveryEpic, projectId, null, 'epic', 'Planejamento de entrega', 'Estruturar roadmap comercial como backlog interno, sem prometer prazo ao cliente.', 90, owner, null, 'medium', 'handoff:roadmap', 20, now));
  if (roadmap.length) {
    roadmap.forEach((entry, index) => {
      const text = cleanText(stringifyItem(entry), 500);
      created.push(item(crypto.randomUUID(), projectId, deliveryEpic, 'story', text || `Etapa ${index + 1}`, 'Item derivado do roadmap comercial; requer refinamento do time de delivery.', 80 - index, owner, null, 'medium', `proposal:roadmap:${index}`, 21 + index, now));
    });
  } else {
    created.push(item(crypto.randomUUID(), projectId, deliveryEpic, 'story', 'Refinar backlog inicial', 'Roadmap não estruturado no handoff; discovery de delivery obrigatório antes de compromisso externo.', 85, owner, addDays(now, 2), 'medium', 'delivery:discovery-gap', 21, now));
  }

  const governanceEpic = crypto.randomUUID();
  created.push(item(governanceEpic, projectId, null, 'epic', 'Governança e qualidade', 'Manter status, riscos, incidentes e evidências de entrega atualizados.', 75, owner, null, 'low', 'delivery:governance', 40, now));
  created.push(item(crypto.randomUUID(), projectId, governanceEpic, 'task', 'Preparar primeiro status report', 'Gerar visão interna de saúde, backlog, bloqueios e próximas ações.', 70, owner, addDays(now, 5), 'low', 'delivery:status-report', 41, now));

  await env.CRM_DB.batch(created.map((x) => env.CRM_DB.prepare(`INSERT INTO delivery_backlog_items
    (id,project_id,parent_id,item_type,title,description,status,priority,owner,due_at,risk_level,blocked_reason,source_ref,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...x)));
  return created.length;
}

function item(id, projectId, parentId, type, title, description, priority, owner, dueAt, risk, sourceRef, order, now) {
  return [id, projectId, parentId, type, cleanText(title, 240), cleanText(description, 1200), 'backlog', priority, owner || null, dueAt, risk, null, sourceRef, order, now, now];
}

async function generateStatusReport(env, projectId, { force = false } = {}) {
  const project = await env.CRM_DB.prepare('SELECT * FROM delivery_projects WHERE id=?').bind(projectId).first();
  if (!project) throw new Error('delivery_project_not_found');
  const reportDate = saoPauloDate();
  if (!force) {
    const exists = await env.CRM_DB.prepare('SELECT id FROM delivery_status_reports WHERE project_id=? AND report_date=?').bind(projectId, reportDate).first();
    if (exists) return { created: false, reportId: exists.id, reason: 'daily_report_exists' };
  }

  const items = await env.CRM_DB.prepare('SELECT * FROM delivery_backlog_items WHERE project_id=? ORDER BY sort_order,created_at').bind(projectId).all();
  const incidents = await env.CRM_DB.prepare("SELECT * FROM delivery_incidents WHERE project_id=? AND status NOT IN ('resolved','closed') ORDER BY detected_at DESC").bind(projectId).all();
  const now = Date.now();
  const rows = items.results || [];
  const active = rows.filter((x) => !['done', 'cancelled'].includes(x.status));
  const blocked = rows.filter((x) => x.status === 'blocked');
  const overdue = active.filter((x) => x.due_at && Date.parse(x.due_at) < now);
  const done = rows.filter((x) => x.status === 'done');
  const openIncidents = incidents.results || [];
  const critical = openIncidents.filter((x) => ['critical', 'high'].includes(x.severity));
  let health = 'green';
  if (critical.length || blocked.length >= 3 || overdue.length >= 4) health = 'red';
  else if (openIncidents.length || blocked.length || overdue.length) health = 'amber';

  const risks = normalizeArray(parseJson(project.risks_json)).map(stringifyItem);
  if (blocked.length) risks.unshift(`${blocked.length} item(ns) bloqueado(s) no backlog.`);
  if (overdue.length) risks.unshift(`${overdue.length} item(ns) interno(s) vencido(s).`);
  if (openIncidents.length) risks.unshift(`${openIncidents.length} incidente(s) aberto(s).`);

  const nextActions = [];
  blocked.slice(0, 3).forEach((x) => nextActions.push(`Desbloquear: ${x.title}`));
  overdue.slice(0, 3).forEach((x) => nextActions.push(`Tratar vencimento interno: ${x.title}`));
  active.filter((x) => x.status === 'ready').slice(0, 3).forEach((x) => nextActions.push(`Executar próximo: ${x.title}`));
  if (!nextActions.length && active[0]) nextActions.push(`Refinar/priorizar: ${active[0].title}`);
  if (!nextActions.length) nextActions.push('Revisar encerramento do projeto e preparar release notes finais.');

  const metrics = { total: rows.length, done: done.length, active: active.length, blocked: blocked.length, overdue: overdue.length, openIncidents: openIncidents.length, completionPct: rows.length ? Math.round(done.length / rows.length * 100) : 0 };
  const summary = `Saúde ${health}. ${metrics.done}/${metrics.total} itens concluídos; ${metrics.blocked} bloqueados; ${metrics.overdue} vencidos; ${metrics.openIncidents} incidentes abertos.`;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  if (force) await env.CRM_DB.prepare('DELETE FROM delivery_status_reports WHERE project_id=? AND report_date=?').bind(projectId, reportDate).run();
  await env.CRM_DB.prepare(`INSERT INTO delivery_status_reports (id,project_id,report_date,health,summary,metrics_json,risks_json,next_actions_json,generated_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, projectId, reportDate, health, summary, JSON.stringify(metrics), JSON.stringify(risks.slice(0, 12)), JSON.stringify(nextActions), 'delivery-agent-v2', createdAt).run();
  await env.CRM_DB.prepare('UPDATE delivery_projects SET health=?,updated_at=? WHERE id=?').bind(health, createdAt, projectId).run();
  return { created: true, reportId: id, health, metrics, summary, nextActions };
}

async function generateReleaseNotes(env, projectId) {
  const project = await env.CRM_DB.prepare('SELECT * FROM delivery_projects WHERE id=?').bind(projectId).first();
  if (!project) throw new Error('delivery_project_not_found');
  const completed = await env.CRM_DB.prepare("SELECT id,title,description,updated_at FROM delivery_backlog_items WHERE project_id=? AND status='done' ORDER BY updated_at ASC LIMIT 100").bind(projectId).all();
  const rows = completed.results || [];
  if (!rows.length) return { created: false, reason: 'no_completed_items' };
  const count = await env.CRM_DB.prepare('SELECT COUNT(*) count FROM delivery_release_notes WHERE project_id=?').bind(projectId).first();
  const sequence = Number(count?.count || 0) + 1;
  const version = `draft-${saoPauloDate()}-${sequence}`;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const items = rows.map((x) => ({ id: x.id, title: x.title, description: x.description || '', completedAt: x.updated_at }));
  const summary = `${items.length} item(ns) concluído(s) incluídos neste rascunho. Revisão humana obrigatória antes de qualquer comunicação externa.`;
  await env.CRM_DB.prepare(`INSERT INTO delivery_release_notes (id,project_id,version,title,summary,items_json,status,generated_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, projectId, version, `Release notes — ${project.name}`, summary, JSON.stringify(items), 'draft', 'delivery-agent-v2', now, now).run();
  return { created: true, releaseNoteId: id, version, itemCount: items.length, status: 'draft' };
}

async function createIncident(env, projectId, body) {
  const project = await env.CRM_DB.prepare('SELECT id FROM delivery_projects WHERE id=?').bind(projectId).first();
  if (!project) throw new Error('delivery_project_not_found');
  const title = cleanText(body.title, 240);
  if (!title) throw new Error('incident_title_required');
  const severity = INCIDENT_SEVERITIES.has(body.severity) ? body.severity : 'medium';
  const description = cleanText(body.description || '', 4000);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const triage = {
    classification: severity,
    immediateChecks: ['Confirmar impacto e usuários/processos afetados', 'Preservar logs e evidências', 'Identificar última mudança conhecida', 'Definir owner humano do incidente'],
    hypotheses: ['Mudança recente a validar', 'Dependência externa a validar', 'Dados/entrada inesperada a validar'],
    evidenceRequired: ['linha do tempo', 'logs relevantes', 'mudanças/deploys', 'passos de reprodução quando aplicável'],
    externalActionsExecuted: false,
  };
  const rca = { status: 'draft_evidence_required', rootCause: null, hypotheses: triage.hypotheses, evidenceRequired: triage.evidenceRequired, humanValidationRequired: true };
  await env.CRM_DB.prepare(`INSERT INTO delivery_incidents (id,project_id,severity,title,description,status,detected_at,triage_json,rca_json,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,'open',?,?,?,?,?,?)`).bind(id, projectId, severity, title, description, now, JSON.stringify(triage), JSON.stringify(rca), 'delivery-agent-v2', now, now).run();
  return mapIncident(await env.CRM_DB.prepare('SELECT * FROM delivery_incidents WHERE id=?').bind(id).first());
}

async function updateBacklogItem(env, id, body) {
  const current = await env.CRM_DB.prepare('SELECT * FROM delivery_backlog_items WHERE id=?').bind(id).first();
  if (!current) return null;
  const status = body.status && BACKLOG_STATUSES.has(body.status) ? body.status : current.status;
  const type = body.itemType && BACKLOG_TYPES.has(body.itemType) ? body.itemType : current.item_type;
  const title = body.title == null ? current.title : cleanText(body.title, 240);
  const blockedReason = body.blockedReason == null ? current.blocked_reason : cleanText(body.blockedReason, 1200) || null;
  const owner = body.owner == null ? current.owner : cleanText(body.owner, 160) || null;
  const dueAt = body.dueAt === undefined ? current.due_at : cleanText(body.dueAt, 80) || null;
  const now = new Date().toISOString();
  await env.CRM_DB.prepare('UPDATE delivery_backlog_items SET item_type=?,title=?,status=?,owner=?,due_at=?,blocked_reason=?,updated_at=? WHERE id=?')
    .bind(type, title, status, owner, dueAt, blockedReason, now, id).run();
  return mapBacklog(await env.CRM_DB.prepare('SELECT * FROM delivery_backlog_items WHERE id=?').bind(id).first());
}

async function updateIncident(env, id, body) {
  const current = await env.CRM_DB.prepare('SELECT * FROM delivery_incidents WHERE id=?').bind(id).first();
  if (!current) return null;
  const status = body.status && INCIDENT_STATUSES.has(body.status) ? body.status : current.status;
  const severity = body.severity && INCIDENT_SEVERITIES.has(body.severity) ? body.severity : current.severity;
  const existingRca = parseJson(current.rca_json) || {};
  const rootCause = cleanText(body.rootCause || '', 3000);
  const rca = rootCause ? { ...existingRca, status: 'human_validated', rootCause, humanValidationRequired: false, validatedAt: new Date().toISOString() } : existingRca;
  const resolvedAt = ['resolved', 'closed'].includes(status) ? (current.resolved_at || new Date().toISOString()) : null;
  const now = new Date().toISOString();
  await env.CRM_DB.prepare('UPDATE delivery_incidents SET severity=?,status=?,resolved_at=?,rca_json=?,updated_at=? WHERE id=?')
    .bind(severity, status, resolvedAt, JSON.stringify(rca), now, id).run();
  return mapIncident(await env.CRM_DB.prepare('SELECT * FROM delivery_incidents WHERE id=?').bind(id).first());
}

async function getDeliverySummary(env) {
  const [projects, backlog, incidents, reports, releases] = await Promise.all([
    env.CRM_DB.prepare('SELECT status,health,COUNT(*) count FROM delivery_projects GROUP BY status,health').all(),
    env.CRM_DB.prepare('SELECT status,COUNT(*) count FROM delivery_backlog_items GROUP BY status').all(),
    env.CRM_DB.prepare("SELECT severity,COUNT(*) count FROM delivery_incidents WHERE status NOT IN ('resolved','closed') GROUP BY severity").all(),
    env.CRM_DB.prepare('SELECT COUNT(*) count,MAX(created_at) latest FROM delivery_status_reports').first(),
    env.CRM_DB.prepare('SELECT COUNT(*) count,MAX(created_at) latest FROM delivery_release_notes').first(),
  ]);
  const projectRows = projects.results || [];
  return {
    agent: DELIVERY_AGENT_V2,
    projects: { total: projectRows.reduce((n, x) => n + Number(x.count || 0), 0), byState: projectRows.map((x) => ({ status: x.status, health: x.health, count: Number(x.count || 0) })) },
    backlog: Object.fromEntries((backlog.results || []).map((x) => [x.status, Number(x.count || 0)])),
    openIncidents: (incidents.results || []).map((x) => ({ severity: x.severity, count: Number(x.count || 0) })),
    reports: { total: Number(reports?.count || 0), latestAt: reports?.latest || null },
    releaseNotes: { total: Number(releases?.count || 0), latestAt: releases?.latest || null },
    externalActionsExecuted: false,
    policy: { failMode: 'fail_closed', shadowFirst: true, externalActivationGate: 'delivery_external_activation' },
  };
}

async function listProjects(env, limit) {
  const rows = await env.CRM_DB.prepare(`SELECT p.*,
    (SELECT COUNT(*) FROM delivery_backlog_items b WHERE b.project_id=p.id) backlog_total,
    (SELECT COUNT(*) FROM delivery_backlog_items b WHERE b.project_id=p.id AND b.status='done') backlog_done,
    (SELECT COUNT(*) FROM delivery_backlog_items b WHERE b.project_id=p.id AND b.status='blocked') backlog_blocked,
    (SELECT COUNT(*) FROM delivery_incidents i WHERE i.project_id=p.id AND i.status NOT IN ('resolved','closed')) incidents_open
    FROM delivery_projects p ORDER BY p.updated_at DESC LIMIT ?`).bind(limit).all();
  return (rows.results || []).map(mapProject);
}

async function getProjectDetail(env, id) {
  const row = await env.CRM_DB.prepare('SELECT * FROM delivery_projects WHERE id=?').bind(id).first();
  if (!row) return null;
  const [backlog, reports, releases, incidents] = await Promise.all([
    env.CRM_DB.prepare('SELECT * FROM delivery_backlog_items WHERE project_id=? ORDER BY sort_order,created_at').bind(id).all(),
    env.CRM_DB.prepare('SELECT * FROM delivery_status_reports WHERE project_id=? ORDER BY report_date DESC LIMIT 20').bind(id).all(),
    env.CRM_DB.prepare('SELECT * FROM delivery_release_notes WHERE project_id=? ORDER BY created_at DESC LIMIT 20').bind(id).all(),
    env.CRM_DB.prepare('SELECT * FROM delivery_incidents WHERE project_id=? ORDER BY detected_at DESC LIMIT 50').bind(id).all(),
  ]);
  return {
    ...mapProject(row),
    backlog: (backlog.results || []).map(mapBacklog),
    reports: (reports.results || []).map((x) => ({ id: x.id, reportDate: x.report_date, health: x.health, summary: x.summary, metrics: parseJson(x.metrics_json), risks: parseJson(x.risks_json), nextActions: parseJson(x.next_actions_json), createdAt: x.created_at })),
    releaseNotes: (releases.results || []).map((x) => ({ id: x.id, version: x.version, title: x.title, summary: x.summary, items: parseJson(x.items_json), status: x.status, createdAt: x.created_at, updatedAt: x.updated_at })),
    incidents: (incidents.results || []).map(mapIncident),
  };
}

function mapProject(x) {
  return { id: x.id, leadId: x.lead_id, handoffId: x.handoff_id, proposalId: x.proposal_id, name: x.name, status: x.status, health: x.health, owner: x.owner, targetDate: x.target_date, scope: parseJson(x.scope_json), risks: parseJson(x.risks_json), assumptions: parseJson(x.assumptions_json), backlogTotal: Number(x.backlog_total || 0), backlogDone: Number(x.backlog_done || 0), backlogBlocked: Number(x.backlog_blocked || 0), incidentsOpen: Number(x.incidents_open || 0), createdAt: x.created_at, updatedAt: x.updated_at };
}
function mapBacklog(x) { return { id: x.id, projectId: x.project_id, parentId: x.parent_id, itemType: x.item_type, title: x.title, description: x.description, status: x.status, priority: Number(x.priority || 0), owner: x.owner, dueAt: x.due_at, riskLevel: x.risk_level, blockedReason: x.blocked_reason, sourceRef: x.source_ref, sortOrder: Number(x.sort_order || 0), createdAt: x.created_at, updatedAt: x.updated_at }; }
function mapIncident(x) { return { id: x.id, projectId: x.project_id, severity: x.severity, title: x.title, description: x.description, status: x.status, detectedAt: x.detected_at, resolvedAt: x.resolved_at, triage: parseJson(x.triage_json), rca: parseJson(x.rca_json), createdAt: x.created_at, updatedAt: x.updated_at }; }

async function getControl(env, agentId) {
  try {
    const row = await env.CRM_DB.prepare('SELECT enabled,shadow_mode,max_tasks_per_run FROM autonomy_agent_controls WHERE agent_id=?').bind(agentId).first();
    return row ? { enabled: Boolean(row.enabled), shadowMode: Boolean(row.shadow_mode), maxTasksPerRun: Number(row.max_tasks_per_run || 0) } : null;
  } catch { return null; }
}
function normalizeArray(value) { if (Array.isArray(value)) return value; if (value == null || value === '') return []; if (typeof value === 'object') return Object.values(value); return [value]; }
function stringifyItem(value) { if (typeof value === 'string') return value; try { return JSON.stringify(value); } catch { return String(value || ''); } }
function parseJson(value) { if (!value) return null; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch { return null; } }
function saoPauloDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function addDays(iso, days) { return new Date(Date.parse(iso) + days * 86400000).toISOString(); }
function cleanText(value, max = 1000) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanError(error) { return cleanText(error?.message || error || 'unknown_error', 500); }
function clamp(n, min, max) { return Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min)); }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function authorizeAdmin(request, env) { const expected = env.CRM_ADMIN_KEY || ''; if (!expected) return false; const provided = request.headers.get('x-crm-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''; return safeEqual(provided, expected); }
function safeEqual(a, b) { const x = new TextEncoder().encode(String(a || '')); const y = new TextEncoder().encode(String(b || '')); let diff = x.length ^ y.length; const len = Math.max(x.length, y.length); for (let i = 0; i < len; i++) diff |= (x[i] || 0) ^ (y[i] || 0); return diff === 0; }
function corsHeaders(request, env) { const origin = request.headers.get('origin') || ''; const allowed = ['https://www.codesolution.com.br', 'https://codesolution.com.br']; const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }; if (allowed.includes(origin)) { h['access-control-allow-origin'] = origin; h['access-control-allow-methods'] = 'GET,POST,PATCH,OPTIONS'; h['access-control-allow-headers'] = 'content-type,x-crm-key,authorization'; h['vary'] = 'Origin'; } return h; }
function respond(data, status, headers) { return new Response(JSON.stringify(data), { status, headers }); }
