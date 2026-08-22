const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const STAGES = ['novo','qualificacao','contato_realizado','discovery','avaliacao_tecnica','proposta','negociacao','follow_up','ganho','perdido','nutricao','arquivado'];
const CLOSED_STAGES = new Set(['ganho','perdido','arquivado']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/health' && request.method === 'GET') return respond({ ok: true, service: 'code-solution-atendente', storage: env.CRM_DB ? 'd1' : 'kv', now: new Date().toISOString() }, 200, cors);
      if (url.pathname === '/chat' && request.method === 'POST') return chat(request, env, cors);
      if (url.pathname === '/lead' && request.method === 'POST') return createLead(request, env, cors);
      if (url.pathname === '/crm/leads' && request.method === 'GET') return listLeads(request, env, cors);
      if (url.pathname === '/crm/summary' && request.method === 'GET') return crmSummary(request, env, cors);
      if (/^\/crm\/lead\/[^/]+$/.test(url.pathname) && request.method === 'GET') return getLead(request, env, cors);
      if (/^\/crm\/lead\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return patchLead(request, env, cors);
      return respond({ ok: false, error: 'not_found' }, 404, cors);
    } catch (error) {
      console.error(error);
      return respond({ ok: false, error: String(error?.message || error).slice(0, 500) }, 500, cors);
    }
  },
};

async function chat(request, env, cors) {
  if (!env.AI_API_KEY) return respond({ ok: false, error: 'ai_not_configured' }, 503, cors);
  const body = await readJson(request);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const context = sanitizeLeadInput(body.context || {});
  const latest = String(messages.at(-1)?.content || '');
  const handoffRequested = /\b(humano|pessoa|atendente|falar com algu[eé]m|suporte|reclama[cç][aã]o)\b/i.test(latest);
  const officeOpen = isBusinessHours();
  const system = `Você é Codi, atendente consultivo da Code Solution. Fale em português do Brasil, com clareza e objetividade. Seu objetivo é entender a dor, identificar se é demanda empresarial, descobrir segmento e coletar nome + WhatsApp. Nunca invente preço, prazo ou capacidade. Quando houver dados suficientes, proponha uma próxima ação simples: diagnóstico/discovery com a equipe. Se a pessoa pedir atendimento humano, confirme a solicitação e não finja ser uma pessoa. Não peça dados sensíveis. Contexto já coletado: ${JSON.stringify(context)}.`;
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.AI_MODEL || DEFAULT_MODEL,
      temperature: 0.35,
      max_tokens: 500,
      messages: [{ role: 'system', content: system }, ...messages.map(normalizeMessage)],
    }),
  });
  if (!response.ok) return respond({ ok: false, error: `ai_${response.status}` }, 502, cors);
  const data = await response.json();
  let message = data?.choices?.[0]?.message?.content || 'Posso entender melhor a sua necessidade?';
  if (handoffRequested && !officeOpen) message += '\n\nSeu pedido de atendimento humano foi registrado. A equipe continuará no próximo período de atendimento.';
  return respond({ ok: true, message, handoffRequested, businessHoursOpen: officeOpen }, 200, cors);
}

async function createLead(request, env, cors) {
  if (!env.LEADS_KV && !env.CRM_DB) return respond({ ok: false, error: 'storage_not_configured' }, 503, cors);
  const raw = sanitizeLeadInput(await readJson(request));
  const validation = validateLead(raw);
  if (!validation.ok) return respond({ ok: false, error: 'validation_error', fields: validation.fields }, 400, cors);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const score = scoreLead(raw);
  const lead = {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'novo',
    score,
    temperature: score >= 75 ? 'quente' : score >= 45 ? 'morno' : 'frio',
    nextAction: score >= 60 ? 'Agendar discovery' : 'Completar qualificação',
    nextActionDue: null,
    owner: null,
    lossReason: null,
    ...raw,
    timeline: [{ at: now, type: 'lead_created', text: 'Lead capturado pelo atendimento digital.' }],
  };
  await writeLead(env, lead);
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.OWNER_WHATSAPP) {
    notifyOwnerWhatsApp(env, lead).catch((error) => console.warn('whatsapp notification failed', error));
  }
  return respond({ ok: true, leadId: id, score, status: lead.status, nextAction: lead.nextAction }, 201, cors);
}

async function listLeads(request, env, cors) {
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  const url = new URL(request.url);
  const stage = url.searchParams.get('status');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 250);
  const items = (await readLeadList(env, limit)).filter((lead) => !stage || lead.status === stage).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return respond({ ok: true, leads: items, stages: STAGES }, 200, cors);
}

async function crmSummary(request, env, cors) {
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  const leads = await readLeadList(env, 1000);
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  const byTemperature = { quente: 0, morno: 0, frio: 0 };
  const bySource = {};
  let scoreTotal = 0;
  let overdueFollowUps = 0;
  let withoutNextAction = 0;
  let openPipelineValue = 0;
  const now = new Date();
  for (const lead of leads) {
    if (lead.status in byStage) byStage[lead.status]++;
    if (lead.temperature in byTemperature) byTemperature[lead.temperature]++;
    const source = lead.source || 'nao_informada';
    bySource[source] = (bySource[source] || 0) + 1;
    scoreTotal += Number(lead.score || 0);
    if (!CLOSED_STAGES.has(lead.status)) {
      if (!lead.nextAction) withoutNextAction++;
      if (lead.nextActionDue) {
        const due = new Date(lead.nextActionDue.length <= 10 ? `${lead.nextActionDue}T23:59:59-03:00` : lead.nextActionDue);
        if (!Number.isNaN(due.getTime()) && due < now) overdueFollowUps++;
      }
      const value = Number(lead.estimatedValue || 0);
      if (Number.isFinite(value) && value > 0) openPipelineValue += value;
    }
  }
  return respond({
    ok: true,
    totalLeads: leads.length,
    averageScore: leads.length ? Math.round(scoreTotal / leads.length) : 0,
    overdueFollowUps,
    withoutNextAction,
    openPipelineValue,
    byStage,
    byTemperature,
    bySource,
    generatedAt: new Date().toISOString(),
  }, 200, cors);
}

async function getLead(request, env, cors) {
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const lead = await readLead(env, id);
  return lead ? respond({ ok: true, lead }, 200, cors) : respond({ ok: false, error: 'not_found' }, 404, cors);
}

async function patchLead(request, env, cors) {
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const lead = await readLead(env, id);
  if (!lead) return respond({ ok: false, error: 'not_found' }, 404, cors);
  const patch = await readJson(request);
  if (patch.status && !STAGES.includes(patch.status)) return respond({ ok: false, error: 'invalid_status', stages: STAGES }, 400, cors);
  const allowed = ['status','nextAction','nextActionDue','owner','lossReason','notes','estimatedValue','expectedCloseDate','company','segment','need','source'];
  const changes = {};
  for (const key of allowed) if (patch[key] !== undefined) changes[key] = cleanValue(patch[key]);
  if (changes.status === 'perdido' && !changes.lossReason && !lead.lossReason) return respond({ ok: false, error: 'loss_reason_required' }, 400, cors);
  const now = new Date().toISOString();
  const updated = { ...lead, ...changes, updatedAt: now };
  const timelineText = patch.timelineText ? String(patch.timelineText).slice(0, 500) : `Lead atualizado: ${Object.keys(changes).join(', ') || 'sem alterações de campos'}.`;
  updated.timeline = [...(Array.isArray(lead.timeline) ? lead.timeline : []), { at: now, type: 'lead_updated', text: timelineText }].slice(-200);
  await writeLead(env, updated);
  return respond({ ok: true, lead: updated }, 200, cors);
}

async function readLead(env, id) {
  if (env.CRM_DB) return readLeadD1(env.CRM_DB, id);
  const value = await env.LEADS_KV?.get(`lead:${id}`);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

async function writeLead(env, lead) {
  if (env.CRM_DB) return writeLeadD1(env.CRM_DB, lead);
  await env.LEADS_KV.put(`lead:${lead.id}`, JSON.stringify(lead));
}

async function readLeadList(env, max = 250) {
  if (env.CRM_DB) {
    const result = await env.CRM_DB.prepare('SELECT * FROM leads ORDER BY updated_at DESC LIMIT ?').bind(max).all();
    const leads = [];
    for (const row of result.results || []) leads.push(await hydrateD1Lead(env.CRM_DB, row));
    return leads;
  }
  if (!env.LEADS_KV) return [];
  const items = [];
  let cursor;
  do {
    const page = await env.LEADS_KV.list({ prefix: 'lead:', limit: Math.min(1000, max - items.length), cursor });
    const values = await Promise.all(page.keys.map(async (key) => {
      try { return JSON.parse(await env.LEADS_KV.get(key.name)); } catch { return null; }
    }));
    items.push(...values.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && items.length < max);
  return items.slice(0, max);
}

async function readLeadD1(db, id) {
  const row = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  return row ? hydrateD1Lead(db, row) : null;
}

async function hydrateD1Lead(db, row) {
  const events = await db.prepare('SELECT event_type, text, created_at FROM lead_events WHERE lead_id = ? ORDER BY created_at ASC LIMIT 200').bind(row.id).all();
  return {
    id: row.id, name: row.name, whatsapp: row.whatsapp, email: row.email, company: row.company, segment: row.segment, need: row.need,
    businessType: row.business_type, urgency: row.urgency, budget: row.budget, decisionMaker: Boolean(row.decision_maker), source: row.source,
    campaign: row.campaign, medium: row.medium, content: row.content, term: row.term, landingPage: row.landing_page, referrer: row.referrer,
    status: row.status, score: row.score, temperature: row.temperature, owner: row.owner, nextAction: row.next_action, nextActionDue: row.next_action_due,
    estimatedValue: row.estimated_value_cents ? row.estimated_value_cents / 100 : null, expectedCloseDate: row.expected_close_date, lossReason: row.loss_reason,
    notes: row.notes, consentAt: row.consent_at, createdAt: row.created_at, updatedAt: row.updated_at,
    timeline: (events.results || []).map((e) => ({ type: e.event_type, text: e.text, at: e.created_at })),
  };
}

async function writeLeadD1(db, lead) {
  const existing = await db.prepare('SELECT id FROM leads WHERE id = ?').bind(lead.id).first();
  const cents = lead.estimatedValue === null || lead.estimatedValue === undefined || lead.estimatedValue === '' ? null : Math.round(Number(lead.estimatedValue) * 100);
  await db.prepare(`INSERT INTO leads (
      id,name,whatsapp,email,company,segment,need,business_type,urgency,budget,decision_maker,source,campaign,medium,content,term,landing_page,referrer,status,score,temperature,owner,next_action,next_action_due,estimated_value_cents,expected_close_date,loss_reason,notes,consent_at,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,whatsapp=excluded.whatsapp,email=excluded.email,company=excluded.company,segment=excluded.segment,need=excluded.need,business_type=excluded.business_type,urgency=excluded.urgency,budget=excluded.budget,decision_maker=excluded.decision_maker,source=excluded.source,campaign=excluded.campaign,medium=excluded.medium,content=excluded.content,term=excluded.term,landing_page=excluded.landing_page,referrer=excluded.referrer,status=excluded.status,score=excluded.score,temperature=excluded.temperature,owner=excluded.owner,next_action=excluded.next_action,next_action_due=excluded.next_action_due,estimated_value_cents=excluded.estimated_value_cents,expected_close_date=excluded.expected_close_date,loss_reason=excluded.loss_reason,notes=excluded.notes,consent_at=excluded.consent_at,updated_at=excluded.updated_at`
    ).bind(
      lead.id,lead.name,lead.whatsapp,lead.email||null,lead.company||null,lead.segment||null,lead.need,lead.businessType||lead.type||null,lead.urgency||null,lead.budget||null,lead.decisionMaker===true||lead.decisionMaker==='sim'?1:0,lead.source||null,lead.campaign||null,lead.medium||null,lead.content||null,lead.term||null,lead.landingPage||null,lead.referrer||null,lead.status,lead.score,lead.temperature,lead.owner||null,lead.nextAction||null,lead.nextActionDue||null,Number.isFinite(cents)?cents:null,lead.expectedCloseDate||null,lead.lossReason||null,lead.notes||null,lead.consentAt||null,lead.createdAt,lead.updatedAt
    ).run();
  const events = Array.isArray(lead.timeline) ? lead.timeline : [];
  if (!existing && events[0]) {
    const e = events[0];
    await db.prepare('INSERT OR IGNORE INTO lead_events (id,lead_id,event_type,text,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),lead.id,e.type||'lead_created',e.text||'',e.at||lead.createdAt).run();
  } else if (existing && events.length) {
    const e = events.at(-1);
    await db.prepare('INSERT INTO lead_events (id,lead_id,event_type,text,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),lead.id,e.type||'lead_updated',e.text||'',e.at||lead.updatedAt).run();
  }
}

function scoreLead(lead) {
  let score = 0;
  if (lead.name) score += 8;
  if (lead.whatsapp) score += 12;
  if (lead.company) score += 10;
  if (lead.segment) score += 8;
  if (lead.need && lead.need.length >= 30) score += 20;
  if (lead.businessType === 'empresa' || lead.type === 'empresa') score += 12;
  if (lead.urgency === 'alta') score += 12; else if (lead.urgency === 'media') score += 7;
  if (lead.budget === 'definido') score += 10; else if (lead.budget === 'avaliando') score += 5;
  if (lead.decisionMaker === true || lead.decisionMaker === 'sim') score += 8;
  return Math.min(score, 100);
}

function sanitizeLeadInput(input) {
  const out = {};
  const fields = ['name','whatsapp','email','company','segment','need','businessType','type','urgency','budget','source','campaign','medium','content','term','landingPage','referrer','notes','decisionMaker','consentAt'];
  for (const key of fields) if (input[key] !== undefined && input[key] !== null) out[key] = cleanValue(input[key]);
  return out;
}
function cleanValue(value) { if (typeof value === 'boolean' || typeof value === 'number') return value; return String(value).replace(/[<>]/g, '').trim().slice(0, 2000); }
function validateLead(lead) { const fields = {}; if (!lead.name || lead.name.length < 2) fields.name = 'required'; if (!lead.whatsapp || String(lead.whatsapp).replace(/\D/g,'').length < 10) fields.whatsapp = 'invalid'; if (!lead.need || lead.need.length < 8) fields.need = 'required'; return { ok: Object.keys(fields).length === 0, fields }; }
function normalizeMessage(message) { return { role: ['assistant','user'].includes(message?.role) ? message.role : 'user', content: String(message?.content || '').slice(0, 3000) }; }
function isBusinessHours() { const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',hour12:false}).formatToParts(new Date()); const weekday=parts.find(p=>p.type==='weekday')?.value; const hour=Number(parts.find(p=>p.type==='hour')?.value); return !['Sat','Sun'].includes(weekday) && hour>=8 && hour<18; }

async function notifyOwnerWhatsApp(env, lead) {
  const digits = String(env.OWNER_WHATSAPP).replace(/\D/g, '');
  const text = `Novo lead Code Solution\n${lead.name}${lead.company ? ` · ${lead.company}` : ''}\nScore: ${lead.score}/100 (${lead.temperature})\nNecessidade: ${lead.need}\nWhatsApp: ${lead.whatsapp}\nPróxima ação: ${lead.nextAction}`.slice(0, 3500);
  const graphVersion = String(env.WHATSAPP_GRAPH_VERSION || 'v23.0').replace(/[^v0-9.]/g,'') || 'v23.0';
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: digits, type: 'text', text: { preview_url: false, body: text } }),
  });
  if (!response.ok) throw new Error(`whatsapp_${response.status}:${(await response.text()).slice(0,300)}`);
}

function authorizeAdmin(request, env) {
  const expected = env.CRM_ADMIN_KEY || '';
  if (!expected) return false;
  const provided = request.headers.get('x-crm-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return safeEqual(provided, expected);
}
function safeEqual(a,b) { if (!a || !b || a.length !== b.length) return false; let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function corsHeaders(request, env) { const origin = request.headers.get('origin') || ''; const allowed = String(env.ALLOWED_ORIGINS || 'https://www.codesolution.com.br,https://codesolution.com.br').split(',').map((x)=>x.trim()); const accepted = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]); return { 'access-control-allow-origin': accepted, 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'content-type,x-crm-key,authorization', 'access-control-max-age': '86400', vary: 'Origin' }; }
function respond(data,status,cors) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff' } }); }
