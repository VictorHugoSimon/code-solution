const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const STAGES = ['novo','qualificacao','contato_realizado','discovery','avaliacao_tecnica','proposta','negociacao','follow_up','ganho','perdido','nutricao','arquivado'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/health' && request.method === 'GET') return respond({ ok: true, service: 'code-solution-atendente', now: new Date().toISOString() }, 200, cors);
      if (url.pathname === '/chat' && request.method === 'POST') return chat(request, env, cors);
      if (url.pathname === '/lead' && request.method === 'POST') return createLead(request, env, cors);
      if (url.pathname === '/crm/leads' && request.method === 'GET') return listLeads(request, env, cors);
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
  const system = `Você é Codi, atendente consultivo da Code Solution. Fale em português do Brasil, com clareza e objetividade. Seu objetivo é entender a dor, identificar se é demanda empresarial, descobrir segmento e coletar nome + WhatsApp. Nunca invente preço, prazo ou capacidade. Quando houver dados suficientes, proponha uma próxima ação simples: diagnóstico/discovery com a equipe. Não peça dados sensíveis. Contexto já coletado: ${JSON.stringify(context)}.`;
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
  return respond({ ok: true, message: data?.choices?.[0]?.message?.content || 'Posso entender melhor a sua necessidade?' }, 200, cors);
}

async function createLead(request, env, cors) {
  if (!env.LEADS_KV) return respond({ ok: false, error: 'storage_not_configured' }, 503, cors);
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
    owner: null,
    lossReason: null,
    ...raw,
    timeline: [{ at: now, type: 'lead_created', text: 'Lead capturado pelo atendimento digital.' }],
  };
  await env.LEADS_KV.put(`lead:${id}`, JSON.stringify(lead));
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
  const listed = await env.LEADS_KV.list({ prefix: 'lead:', limit });
  const items = (await Promise.all(listed.keys.map(async (key) => {
    try { return JSON.parse(await env.LEADS_KV.get(key.name)); } catch { return null; }
  }))).filter(Boolean).filter((lead) => !stage || lead.status === stage).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return respond({ ok: true, leads: items, stages: STAGES, cursor: listed.cursor || null, listComplete: listed.list_complete ?? true }, 200, cors);
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
  const allowed = ['status','nextAction','owner','lossReason','notes','estimatedValue','expectedCloseDate','company','segment','need','source'];
  const changes = {};
  for (const key of allowed) if (patch[key] !== undefined) changes[key] = cleanValue(patch[key]);
  if (changes.status === 'perdido' && !changes.lossReason && !lead.lossReason) return respond({ ok: false, error: 'loss_reason_required' }, 400, cors);
  const now = new Date().toISOString();
  const updated = { ...lead, ...changes, updatedAt: now };
  const timelineText = patch.timelineText ? String(patch.timelineText).slice(0, 500) : `Lead atualizado: ${Object.keys(changes).join(', ') || 'sem alterações de campos'}.`;
  updated.timeline = [...(Array.isArray(lead.timeline) ? lead.timeline : []), { at: now, type: 'lead_updated', text: timelineText }].slice(-200);
  await env.LEADS_KV.put(`lead:${id}`, JSON.stringify(updated));
  return respond({ ok: true, lead: updated }, 200, cors);
}

async function readLead(env, id) {
  const value = await env.LEADS_KV.get(`lead:${id}`);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
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
  const fields = ['name','whatsapp','email','company','segment','need','businessType','type','urgency','budget','source','campaign','medium','content','term','landingPage','referrer','notes','decisionMaker'];
  for (const key of fields) if (input[key] !== undefined && input[key] !== null) out[key] = cleanValue(input[key]);
  return out;
}
function cleanValue(value) { if (typeof value === 'boolean' || typeof value === 'number') return value; return String(value).replace(/[<>]/g, '').trim().slice(0, 2000); }
function validateLead(lead) { const fields = {}; if (!lead.name || lead.name.length < 2) fields.name = 'required'; if (!lead.whatsapp || String(lead.whatsapp).replace(/\D/g,'').length < 10) fields.whatsapp = 'invalid'; if (!lead.need || lead.need.length < 8) fields.need = 'required'; return { ok: Object.keys(fields).length === 0, fields }; }
function normalizeMessage(message) { return { role: ['assistant','user'].includes(message?.role) ? message.role : 'user', content: String(message?.content || '').slice(0, 3000) }; }

async function notifyOwnerWhatsApp(env, lead) {
  const digits = String(env.OWNER_WHATSAPP).replace(/\D/g, '');
  const text = `Novo lead Code Solution\n${lead.name}${lead.company ? ` · ${lead.company}` : ''}\nScore: ${lead.score}/100 (${lead.temperature})\nNecessidade: ${lead.need}\nWhatsApp: ${lead.whatsapp}\nPróxima ação: ${lead.nextAction}`.slice(0, 3500);
  const response = await fetch(`https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_ID}/messages`, {
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
