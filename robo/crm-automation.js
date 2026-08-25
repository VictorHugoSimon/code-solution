const CLOSED = new Set(['ganho','perdido','arquivado']);
const ACTIVE_STAGE = new Set(['novo','qualificacao','contato_realizado','discovery','avaliacao_tecnica','proposta','negociacao','follow_up','nutricao']);
const ALERT_TYPES = ['sla_first_contact','followup_overdue','next_action_missing','hot_lead_waiting'];

export async function handleCommercialApi(request, env, cors = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/')) return null;
  if (!authorizeAdmin(request, env)) return respond({ ok:false, error:'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok:false, error:'crm_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/operations/summary' && request.method === 'GET') {
    await runCommercialAutomation(env, { trigger:'dashboard', notify:false });
    return operationsSummary(env, cors);
  }
  if (url.pathname === '/crm/acquisition/summary' && request.method === 'GET') return acquisitionSummary(request, env, cors);
  if (url.pathname === '/crm/alerts' && request.method === 'GET') {
    await runCommercialAutomation(env, { trigger:'alerts_view', notify:false });
    return listAlerts(request, env, cors);
  }
  if (/^\/crm\/alert\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return patchAlert(request, env, cors);
  if (url.pathname === '/crm/tasks' && request.method === 'GET') return listTasks(request, env, cors);
  if (/^\/crm\/task\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return patchTask(request, env, cors);
  if (url.pathname === '/crm/owners' && request.method === 'GET') return listOwners(env, cors);
  if (url.pathname === '/crm/owners' && request.method === 'POST') return createOwner(request, env, cors);
  if (/^\/crm\/owner\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return patchOwner(request, env, cors);
  if (url.pathname === '/crm/automation/run' && request.method === 'POST') {
    const result = await runCommercialAutomation(env, { trigger:'manual', notify:true });
    return respond({ ok:true, ...result }, 200, cors);
  }
  return null;
}

export async function afterLeadCreated(env, payload = {}) {
  if (!env.CRM_DB || !payload.leadId) return;
  const leadId = String(payload.leadId);
  const now = new Date().toISOString();
  const sessionId = clean(payload.sessionId, 80);
  if (/^[A-Za-z0-9._:-]{8,80}$/.test(sessionId)) {
    await env.CRM_DB.prepare(`INSERT INTO lead_acquisition_links
      (lead_id,session_id,source,medium,campaign,landing_page,linked_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(lead_id) DO UPDATE SET session_id=excluded.session_id,source=excluded.source,medium=excluded.medium,campaign=excluded.campaign,landing_page=excluded.landing_page,linked_at=excluded.linked_at`)
      .bind(leadId, sessionId, clean(payload.source,100)||null, clean(payload.medium,100)||null, clean(payload.campaign,160)||null, safePath(payload.landingPage), now).run();
  }
  const lead = await env.CRM_DB.prepare('SELECT * FROM leads WHERE id=?').bind(leadId).first();
  if (!lead) return;
  await ensureOwner(env, lead, now);
  const refreshed = await env.CRM_DB.prepare('SELECT * FROM leads WHERE id=?').bind(leadId).first();
  await ensureNextActionTask(env, refreshed, now);
  await refreshLeadAlerts(env, refreshed, now);
}

export async function beforeLeadPatch(env, leadId) {
  if (!env.CRM_DB || !leadId) return null;
  return env.CRM_DB.prepare('SELECT * FROM leads WHERE id=?').bind(String(leadId)).first();
}

export async function afterLeadPatched(env, before, responseData, actor = 'panel') {
  if (!env.CRM_DB || !before || !responseData?.lead?.id) return;
  const after = await env.CRM_DB.prepare('SELECT * FROM leads WHERE id=?').bind(responseData.lead.id).first();
  if (!after) return;
  const now = new Date().toISOString();
  const events = [];

  if (before.status !== after.status) {
    events.push(['stage_changed', `Etapa alterada de ${before.status} para ${after.status}.`, { from:before.status, to:after.status }]);
    if (after.status === 'contato_realizado') events.push(['first_contact', 'Primeiro contato comercial registrado.', { stage:after.status }]);
    if (after.status === 'discovery') events.push(['discovery_reached', 'Lead chegou à etapa de discovery.', { stage:after.status }]);
    if (after.status === 'proposta') events.push(['proposal_reached', 'Proposta registrada no funil.', { stage:after.status }]);
    if (after.status === 'ganho') events.push(['deal_won', 'Oportunidade marcada como ganha.', { stage:after.status }]);
  }
  if ((before.owner || '') !== (after.owner || '')) events.push(['owner_changed', `Responsável alterado de ${before.owner || 'sem responsável'} para ${after.owner || 'sem responsável'}.`, { from:before.owner||null,to:after.owner||null }]);
  if ((before.next_action || '') !== (after.next_action || '') || (before.next_action_due || '') !== (after.next_action_due || '')) {
    events.push(['next_action_changed', `Próxima ação atualizada para ${after.next_action || 'não definida'}${after.next_action_due ? ` (${after.next_action_due})` : ''}.`, { action:after.next_action||null,due:after.next_action_due||null }]);
  }

  for (const [type,text,meta] of events) {
    const exists = ['first_contact','discovery_reached','proposal_reached','deal_won'].includes(type)
      ? await env.CRM_DB.prepare('SELECT id FROM lead_events WHERE lead_id=? AND event_type=? LIMIT 1').bind(after.id,type).first()
      : null;
    if (exists) continue;
    await env.CRM_DB.prepare('INSERT INTO lead_events (id,lead_id,event_type,text,actor,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),after.id,type,text,actor,JSON.stringify(meta),now).run();
  }

  await env.CRM_DB.prepare('INSERT INTO crm_audit_log (id,lead_id,action,actor,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),after.id,'lead_patch',actor,JSON.stringify(compactLead(before)),JSON.stringify(compactLead(after)),now).run();

  await ensureNextActionTask(env, after, now);
  await refreshLeadAlerts(env, after, now);
}

export async function runCommercialAutomation(env, { trigger='scheduled', notify=false } = {}) {
  if (!env.CRM_DB) return { leadsScanned:0, alertsCreated:0, tasksCreated:0, ownersAssigned:0, notificationsSent:0 };
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await env.CRM_DB.prepare('INSERT INTO crm_automation_runs (id,trigger_type,started_at) VALUES (?,?,?)').bind(runId,trigger,startedAt).run();
  const stats = { leadsScanned:0, alertsCreated:0, tasksCreated:0, ownersAssigned:0, notificationsSent:0 };
  const newAlerts = [];
  try {
    await syncOwnersFromEnv(env, startedAt);
    const result = await env.CRM_DB.prepare("SELECT * FROM leads WHERE status NOT IN ('ganho','perdido','arquivado') ORDER BY created_at ASC LIMIT 2000").all();
    for (const original of result.results || []) {
      stats.leadsScanned++;
      let lead = original;
      if (!lead.owner) {
        const assigned = await ensureOwner(env, lead, startedAt);
        if (assigned) {
          stats.ownersAssigned++;
          lead = await env.CRM_DB.prepare('SELECT * FROM leads WHERE id=?').bind(lead.id).first();
        }
      }
      if (await ensureNextActionTask(env, lead, startedAt)) stats.tasksCreated++;
      const created = await refreshLeadAlerts(env, lead, startedAt);
      stats.alertsCreated += created.length;
      newAlerts.push(...created);
    }
    if (notify && newAlerts.length) stats.notificationsSent = await notifyNewAlerts(env, newAlerts);
    const completedAt = new Date().toISOString();
    await env.CRM_DB.prepare(`UPDATE crm_automation_runs SET completed_at=?,leads_scanned=?,alerts_created=?,tasks_created=?,owners_assigned=?,notifications_sent=? WHERE id=?`)
      .bind(completedAt,stats.leadsScanned,stats.alertsCreated,stats.tasksCreated,stats.ownersAssigned,stats.notificationsSent,runId).run();
    return stats;
  } catch (error) {
    await env.CRM_DB.prepare('UPDATE crm_automation_runs SET completed_at=?,error_text=? WHERE id=?').bind(new Date().toISOString(),String(error?.message||error).slice(0,900),runId).run().catch(()=>{});
    throw error;
  }
}

async function operationsSummary(env, cors) {
  const [alertsResult,tasksResult,ownersResult,runsResult,leadsResult,eventsResult] = await Promise.all([
    env.CRM_DB.prepare("SELECT id,lead_id,alert_type,severity,status,title,detail,owner,due_at,created_at FROM crm_alerts WHERE status='open' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at ASC LIMIT 100").all(),
    env.CRM_DB.prepare("SELECT id,lead_id,title,due_at,status,owner,created_at,completed_at FROM crm_tasks WHERE status='aberta' ORDER BY COALESCE(due_at,'9999') ASC LIMIT 200").all(),
    env.CRM_DB.prepare("SELECT id,name,active,weight FROM crm_owners WHERE active=1 ORDER BY name").all(),
    env.CRM_DB.prepare('SELECT * FROM crm_automation_runs ORDER BY started_at DESC LIMIT 10').all(),
    env.CRM_DB.prepare('SELECT id,status,owner,created_at,updated_at FROM leads ORDER BY created_at DESC LIMIT 2000').all(),
    env.CRM_DB.prepare("SELECT lead_id,event_type,created_at FROM lead_events WHERE event_type IN ('first_contact','discovery_reached','proposal_reached','deal_won') ORDER BY created_at ASC LIMIT 10000").all(),
  ]);
  const velocity = calculateVelocity(leadsResult.results || [], eventsResult.results || []);
  const openAlerts = alertsResult.results || [];
  return respond({
    ok:true,
    openAlerts,
    alertCounts: countBy(openAlerts,'alert_type'),
    severityCounts: countBy(openAlerts,'severity'),
    openTasks: tasksResult.results || [],
    activeOwners: ownersResult.results || [],
    velocity,
    recentAutomationRuns: runsResult.results || [],
    generatedAt:new Date().toISOString(),
  },200,cors);
}

async function acquisitionSummary(request, env, cors) {
  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 30),1),365);
  const since = new Date(Date.now() - days*86400000).toISOString();
  const [eventsResult,linksResult] = await Promise.all([
    env.CRM_DB.prepare('SELECT session_id,event_name,page_path,source,medium,campaign,metadata_json,created_at FROM acquisition_events WHERE created_at>=? ORDER BY created_at ASC LIMIT 20000').bind(since).all(),
    env.CRM_DB.prepare(`SELECT l.lead_id,l.session_id,l.source,l.medium,l.campaign,l.landing_page,l.linked_at,leads.status,leads.score,leads.temperature
      FROM lead_acquisition_links l JOIN leads ON leads.id=l.lead_id WHERE l.linked_at>=? ORDER BY l.linked_at ASC LIMIT 5000`).bind(since).all(),
  ]);
  const events = eventsResult.results || [];
  const links = linksResult.results || [];
  const sessions = new Set(events.map(x=>x.session_id));
  const engagedNames = new Set(['cta_click','whatsapp_click','assistant_open','diagnostic_open','calculator_open','blog_cta_click','scroll_90']);
  const engaged = new Set(events.filter(x=>engagedNames.has(x.event_name)).map(x=>x.session_id));
  const formStarts = new Set(events.filter(x=>x.event_name==='lead_form_start').map(x=>x.session_id));
  const leadSessions = new Set(links.map(x=>x.session_id));
  const wonSessions = new Set(links.filter(x=>x.status==='ganho').map(x=>x.session_id));
  const bySource = aggregateAcquisition(events,links,'source');
  const byCampaign = aggregateAcquisition(events,links,'campaign');
  const contentInfluence = links.filter(x=>String(x.landing_page||'').startsWith('/blog/')).reduce((m,x)=>{const k=x.landing_page||'blog';const v=m.get(k)||{leads:0,wins:0};v.leads++;if(x.status==='ganho')v.wins++;m.set(k,v);return m;},new Map());
  return respond({
    ok:true,days,since,
    funnel:{ visits:sessions.size, engaged:engaged.size, formStarts:formStarts.size, leads:leadSessions.size, won:wonSessions.size },
    conversion:{ visitToEngaged:pct(engaged.size,sessions.size), visitToLead:pct(leadSessions.size,sessions.size), leadToWon:pct(wonSessions.size,leadSessions.size) },
    eventCounts:countBy(events,'event_name'),
    bySource,
    byCampaign,
    contentInfluence:[...contentInfluence.entries()].map(([page,v])=>({page,...v})).sort((a,b)=>b.leads-a.leads).slice(0,50),
    linkedLeadCoverage:{ linked:links.length },
    generatedAt:new Date().toISOString(),
  },200,cors);
}

async function listAlerts(request, env, cors) {
  const url = new URL(request.url);
  const status = clean(url.searchParams.get('status'),20) || 'open';
  const result = await env.CRM_DB.prepare('SELECT * FROM crm_alerts WHERE status=? ORDER BY created_at DESC LIMIT 250').bind(status).all();
  return respond({ok:true,alerts:result.results||[]},200,cors);
}

async function patchAlert(request, env, cors) {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const body = await readJson(request);
  const status = ['open','resolved','dismissed'].includes(body.status) ? body.status : null;
  if (!status) return respond({ok:false,error:'invalid_status'},400,cors);
  const resolvedAt = status==='open' ? null : new Date().toISOString();
  await env.CRM_DB.prepare('UPDATE crm_alerts SET status=?,resolved_at=? WHERE id=?').bind(status,resolvedAt,id).run();
  const row = await env.CRM_DB.prepare('SELECT * FROM crm_alerts WHERE id=?').bind(id).first();
  return row ? respond({ok:true,alert:row},200,cors) : respond({ok:false,error:'not_found'},404,cors);
}

async function listTasks(request, env, cors) {
  const url = new URL(request.url);
  const status = clean(url.searchParams.get('status'),20) || 'aberta';
  const result = await env.CRM_DB.prepare('SELECT * FROM crm_tasks WHERE status=? ORDER BY COALESCE(due_at,\'9999\') ASC LIMIT 500').bind(status).all();
  return respond({ok:true,tasks:result.results||[]},200,cors);
}

async function patchTask(request, env, cors) {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const body = await readJson(request);
  const current = await env.CRM_DB.prepare('SELECT * FROM crm_tasks WHERE id=?').bind(id).first();
  if (!current) return respond({ok:false,error:'not_found'},404,cors);
  const status = body.status===undefined ? current.status : clean(body.status,20);
  if (!['aberta','concluida','cancelada'].includes(status)) return respond({ok:false,error:'invalid_status'},400,cors);
  const title = body.title===undefined ? current.title : clean(body.title,240);
  const dueAt = body.dueAt===undefined ? current.due_at : clean(body.dueAt,80)||null;
  const owner = body.owner===undefined ? current.owner : clean(body.owner,120)||null;
  const completedAt = status==='concluida' ? (current.completed_at || new Date().toISOString()) : null;
  await env.CRM_DB.prepare('UPDATE crm_tasks SET title=?,due_at=?,status=?,owner=?,completed_at=? WHERE id=?').bind(title,dueAt,status,owner,completedAt,id).run();
  return respond({ok:true,task:await env.CRM_DB.prepare('SELECT * FROM crm_tasks WHERE id=?').bind(id).first()},200,cors);
}

async function listOwners(env, cors) {
  const result = await env.CRM_DB.prepare('SELECT id,name,active,weight,created_at,updated_at FROM crm_owners ORDER BY active DESC,name').all();
  return respond({ok:true,owners:result.results||[]},200,cors);
}

async function createOwner(request, env, cors) {
  const body = await readJson(request);
  const name = clean(body.name,120);
  if (!name) return respond({ok:false,error:'name_required'},400,cors);
  const now = new Date().toISOString();
  const id = slug(name)+'-'+crypto.randomUUID().slice(0,8);
  await env.CRM_DB.prepare('INSERT INTO crm_owners (id,name,active,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id,name,1,Math.max(1,Number(body.weight||1)),now,now).run();
  return respond({ok:true,owner:await env.CRM_DB.prepare('SELECT * FROM crm_owners WHERE id=?').bind(id).first()},201,cors);
}

async function patchOwner(request, env, cors) {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const body = await readJson(request);
  const current = await env.CRM_DB.prepare('SELECT * FROM crm_owners WHERE id=?').bind(id).first();
  if (!current) return respond({ok:false,error:'not_found'},404,cors);
  const active = body.active===undefined ? current.active : (body.active?1:0);
  const weight = body.weight===undefined ? current.weight : Math.max(1,Math.min(20,Number(body.weight||1)));
  const name = body.name===undefined ? current.name : clean(body.name,120);
  await env.CRM_DB.prepare('UPDATE crm_owners SET name=?,active=?,weight=?,updated_at=? WHERE id=?').bind(name,active,weight,new Date().toISOString(),id).run();
  return respond({ok:true,owner:await env.CRM_DB.prepare('SELECT * FROM crm_owners WHERE id=?').bind(id).first()},200,cors);
}

async function syncOwnersFromEnv(env, now) {
  const names = String(env.CRM_OWNERS || '').split(',').map(x=>clean(x,120)).filter(Boolean);
  for (const name of names) {
    await env.CRM_DB.prepare(`INSERT INTO crm_owners (id,name,active,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(name) DO UPDATE SET active=1,updated_at=excluded.updated_at`)
      .bind(slug(name),name,1,1,now,now).run();
  }
}

async function ensureOwner(env, lead, now) {
  if (!env.CRM_DB || lead.owner || CLOSED.has(lead.status)) return false;
  const ownersResult = await env.CRM_DB.prepare('SELECT id,name,weight FROM crm_owners WHERE active=1 ORDER BY name').all();
  const owners = ownersResult.results || [];
  if (!owners.length) return false;
  const countsResult = await env.CRM_DB.prepare("SELECT owner,COUNT(*) c FROM leads WHERE status NOT IN ('ganho','perdido','arquivado') AND owner IS NOT NULL GROUP BY owner").all();
  const counts = new Map((countsResult.results||[]).map(x=>[x.owner,Number(x.c||0)]));
  owners.sort((a,b)=>((counts.get(a.name)||0)/Math.max(1,Number(a.weight||1)))-((counts.get(b.name)||0)/Math.max(1,Number(b.weight||1))) || a.name.localeCompare(b.name));
  const owner = owners[0].name;
  await env.CRM_DB.prepare('UPDATE leads SET owner=?,updated_at=? WHERE id=?').bind(owner,now,lead.id).run();
  await env.CRM_DB.prepare('INSERT INTO lead_events (id,lead_id,event_type,text,actor,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),lead.id,'owner_assigned',`Lead distribuído automaticamente para ${owner}.`,'Code Solution',JSON.stringify({owner,policy:'weighted_least_loaded'}),now).run();
  await env.CRM_DB.prepare('INSERT INTO crm_audit_log (id,lead_id,action,actor,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),lead.id,'owner_auto_assigned','Code Solution',JSON.stringify({owner:null}),JSON.stringify({owner}),now).run();
  return true;
}

async function ensureNextActionTask(env, lead, now) {
  if (!lead || CLOSED.has(lead.status)) {
    if (lead?.id) await env.CRM_DB.prepare("UPDATE crm_tasks SET status='concluida',completed_at=COALESCE(completed_at,?) WHERE id=? AND status='aberta'").bind(now,`next:${lead.id}`).run();
    return false;
  }
  const title = clean(lead.next_action,240) || (lead.status==='novo' ? 'Realizar primeiro contato' : 'Definir próxima ação');
  const dueAt = dueAtFromLead(lead);
  const id = `next:${lead.id}`;
  const existing = await env.CRM_DB.prepare('SELECT id FROM crm_tasks WHERE id=?').bind(id).first();
  await env.CRM_DB.prepare(`INSERT INTO crm_tasks (id,lead_id,title,due_at,status,owner,created_at,completed_at) VALUES (?,?,?,?,?,?,?,NULL)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,due_at=excluded.due_at,status='aberta',owner=excluded.owner,completed_at=NULL`)
    .bind(id,lead.id,title,dueAt, 'aberta', lead.owner||null, now).run();
  return !existing;
}

async function refreshLeadAlerts(env, lead, now) {
  if (!lead || CLOSED.has(lead.status)) {
    if (lead?.id) await env.CRM_DB.prepare("UPDATE crm_alerts SET status='resolved',resolved_at=? WHERE lead_id=? AND status='open'").bind(now,lead.id).run();
    return [];
  }
  const conditions = {
    sla_first_contact: lead.status==='novo' && hoursSince(lead.created_at)>4,
    followup_overdue: isDueOverdue(lead.next_action_due),
    next_action_missing: !clean(lead.next_action,240),
    hot_lead_waiting: Number(lead.score||0)>=75 && ['novo','qualificacao'].includes(lead.status) && hoursSince(lead.updated_at||lead.created_at)>1,
  };
  const specs = {
    sla_first_contact:['critical','SLA de primeiro contato vencido','Lead novo há mais de 4 horas sem avanço comercial.'],
    followup_overdue:['critical','Follow-up vencido','A próxima ação está com prazo vencido.'],
    next_action_missing:['warning','Próxima ação não definida','O lead aberto precisa de uma próxima ação clara.'],
    hot_lead_waiting:['warning','Lead quente aguardando atendimento','Lead de alta prioridade está aguardando avanço.'],
  };
  const created = [];
  for (const type of ALERT_TYPES) {
    const uniqueKey = `${lead.id}:${type}`;
    const existing = await env.CRM_DB.prepare('SELECT id,status FROM crm_alerts WHERE unique_key=?').bind(uniqueKey).first();
    if (conditions[type]) {
      const [severity,title,detail] = specs[type];
      const id = existing?.id || crypto.randomUUID();
      await env.CRM_DB.prepare(`INSERT INTO crm_alerts (id,lead_id,alert_type,severity,status,title,detail,owner,due_at,unique_key,created_at,resolved_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)
        ON CONFLICT(unique_key) DO UPDATE SET severity=excluded.severity,status='open',title=excluded.title,detail=excluded.detail,owner=excluded.owner,due_at=excluded.due_at,resolved_at=NULL`)
        .bind(id,lead.id,type,severity,'open',title,detail,lead.owner||null,lead.next_action_due||null,uniqueKey,now).run();
      if (!existing || existing.status!=='open') created.push({id,leadId:lead.id,type,severity,title,owner:lead.owner||null,name:lead.name||lead.company||'Lead'});
    } else if (existing?.status==='open') {
      await env.CRM_DB.prepare("UPDATE crm_alerts SET status='resolved',resolved_at=? WHERE unique_key=?").bind(now,uniqueKey).run();
    }
  }
  return created;
}

async function notifyNewAlerts(env, alerts) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID || !env.OWNER_WHATSAPP || !alerts.length) return 0;
  const digits = String(env.OWNER_WHATSAPP).replace(/\D/g,'');
  if (!digits) return 0;
  const top = alerts.slice(0,8);
  const text = `Code Solution · alertas comerciais\n\n${top.map(a=>`• ${a.title}: ${a.name}${a.owner?` · ${a.owner}`:''}`).join('\n')}${alerts.length>top.length?`\n\n+${alerts.length-top.length} alerta(s).`:''}\n\nAcesse https://www.codesolution.com.br/painel/agenda/`;
  const response = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`,{
    method:'POST',headers:{Authorization:`Bearer ${env.WHATSAPP_TOKEN}`,'content-type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',to:digits,type:'text',text:{preview_url:false,body:text}}),
  });
  return response.ok ? 1 : 0;
}

function calculateVelocity(leads, events) {
  const byLead = new Map();
  for (const event of events) {
    if (!byLead.has(event.lead_id)) byLead.set(event.lead_id,{});
    const map = byLead.get(event.lead_id);
    if (!map[event.event_type]) map[event.event_type] = event.created_at;
  }
  const metrics = { firstContact:[], discovery:[], proposal:[], won:[] };
  let slaMeasured=0,slaWithin4h=0;
  for (const lead of leads) {
    const created = Date.parse(lead.created_at);
    if (!Number.isFinite(created)) continue;
    const e = byLead.get(lead.id)||{};
    const add=(key,type)=>{const ts=Date.parse(e[type]||'');if(Number.isFinite(ts)&&ts>=created)metrics[key].push((ts-created)/3600000)};
    add('firstContact','first_contact');add('discovery','discovery_reached');add('proposal','proposal_reached');add('won','deal_won');
    if (e.first_contact) { const h=(Date.parse(e.first_contact)-created)/3600000; if(Number.isFinite(h)&&h>=0){slaMeasured++;if(h<=4)slaWithin4h++;} }
  }
  return {
    avgHoursToFirstContact: avg(metrics.firstContact),
    avgHoursToDiscovery: avg(metrics.discovery),
    avgHoursToProposal: avg(metrics.proposal),
    avgHoursToWin: avg(metrics.won),
    measured:{firstContact:metrics.firstContact.length,discovery:metrics.discovery.length,proposal:metrics.proposal.length,won:metrics.won.length},
    firstContactSla:{measured:slaMeasured,within4h:slaWithin4h,compliancePercent:pct(slaWithin4h,slaMeasured)},
  };
}

function aggregateAcquisition(events, links, field) {
  const map = new Map();
  for (const event of events) {
    const key = clean(event[field],160) || '(não informado)';
    if (!map.has(key)) map.set(key,{sessions:new Set(),events:0,leads:0,wins:0,hot:0});
    const v=map.get(key);v.sessions.add(event.session_id);v.events++;
  }
  for (const link of links) {
    const key = clean(link[field],160) || '(não informado)';
    if (!map.has(key)) map.set(key,{sessions:new Set(),events:0,leads:0,wins:0,hot:0});
    const v=map.get(key);v.sessions.add(link.session_id);v.leads++;if(link.status==='ganho')v.wins++;if(link.temperature==='quente')v.hot++;
  }
  return [...map.entries()].map(([name,v])=>({name,sessions:v.sessions.size,events:v.events,leads:v.leads,wins:v.wins,hotLeads:v.hot,visitToLeadPercent:pct(v.leads,v.sessions.size),leadToWinPercent:pct(v.wins,v.leads)})).sort((a,b)=>b.leads-a.leads||b.sessions-a.sessions).slice(0,100);
}

function countBy(items,key){const out={};for(const item of items){const k=item[key]||'unknown';out[k]=(out[k]||0)+1;}return out;}
function avg(values){if(!values.length)return null;return Math.round((values.reduce((a,b)=>a+b,0)/values.length)*10)/10;}
function pct(a,b){return b?Math.round((a/b)*1000)/10:0;}
function hoursSince(value){const ts=Date.parse(value||'');return Number.isFinite(ts)?(Date.now()-ts)/3600000:0;}
function isDueOverdue(value){if(!value)return false;const key=String(value).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(key)&&key<todaySaoPaulo();}
function dueAtFromLead(lead){const raw=clean(lead.next_action_due,80);if(!raw)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return `${raw}T17:00:00-03:00`;return raw;}
function todaySaoPaulo(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function safePath(v){const s=clean(v,500);return s.startsWith('/')&&!s.startsWith('//')?s.split('?')[0].split('#')[0].slice(0,300):null;}
function compactLead(x){return {id:x.id,status:x.status,owner:x.owner||null,nextAction:x.next_action||null,nextActionDue:x.next_action_due||null,score:x.score,updatedAt:x.updated_at};}
function slug(v){return clean(v,120).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'owner';}
function clean(v,max=500){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);}
async function readJson(request){try{return await request.json();}catch{return {};}}
function authorizeAdmin(request,env){const expected=env.CRM_ADMIN_KEY||'';const provided=request.headers.get('x-crm-key')||request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';return safeEqual(provided,expected);}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function respond(data,status,cors){return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
