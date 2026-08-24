import baseWorker from './atendente-worker.js';

const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const RUNTIME_BUILD = 'code-solution-workers-ai-2026-08-24.4';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/lead' && request.method === 'POST') {
      return createLeadWithCommercialSla(request, env, ctx);
    }

    if (url.pathname !== '/chat' || request.method !== 'POST') {
      return baseWorker.fetch(request, env, ctx);
    }

    if (!env.AI || typeof env.AI.run !== 'function') {
      return rebrandChatResponse(await baseWorker.fetch(request, env, ctx));
    }

    const fallbackRequest = request.clone();
    const cors = corsHeaders(request, env);
    try {
      const body = await readJson(request);
      const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      const context = sanitizeLeadContext(body.context || {});
      const latest = String(messages.at(-1)?.content || '');
      const handoffRequested = /\b(humano|pessoa|atendente|falar com algu[eé]m|suporte|reclama[cç][aã]o)\b/i.test(latest);
      const officeOpen = isBusinessHours();
      const system = `Você é o assistente digital da Code Solution. Apresente-se sempre como Code Solution, nunca como Codi. Fale em português do Brasil, com clareza e objetividade. Seu objetivo é entender a dor, identificar se é demanda empresarial, descobrir segmento e coletar nome + WhatsApp. Nunca invente preço, prazo ou capacidade. Quando houver dados suficientes, proponha uma próxima ação simples: diagnóstico/discovery com a equipe. Se a pessoa pedir atendimento humano, confirme a solicitação e não finja ser uma pessoa. Não peça dados sensíveis. Contexto já coletado: ${JSON.stringify(context)}.`;

      const result = await env.AI.run(env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL, {
        messages: [{ role: 'system', content: system }, ...messages.map(normalizeMessage)],
        temperature: 0.35,
        max_tokens: 500,
      });

      let message = extractMessage(result);
      if (!message) throw new Error('workers_ai_empty_response');
      message = message.replace(/\bCodi\b/g, 'Code Solution');
      if (handoffRequested && !officeOpen) {
        message += '\n\nSeu pedido de atendimento humano foi registrado. A equipe continuará no próximo período de atendimento.';
      }
      return respond({
        ok: true,
        message,
        handoffRequested,
        businessHoursOpen: officeOpen,
        provider: 'cloudflare-workers-ai',
        runtimeBuild: RUNTIME_BUILD,
      }, 200, cors);
    } catch (error) {
      console.warn('Workers AI chat failed; trying configured fallback provider.', String(error?.message || error));
      return rebrandChatResponse(await baseWorker.fetch(fallbackRequest, env, ctx));
    }
  },
};

async function createLeadWithCommercialSla(request, env, ctx) {
  const response = await baseWorker.fetch(request, env, ctx);
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 201 || !contentType.includes('application/json')) return response;

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { return cloneTextResponse(response, text); }
  if (!data?.ok || !data?.leadId) return cloneJsonResponse(response, data);

  const score = Number(data.score || 0);
  const sla = commercialSla(score);
  const now = new Date().toISOString();
  try {
    if (env.CRM_DB) {
      await env.CRM_DB.prepare('UPDATE leads SET next_action_due = ?, updated_at = ? WHERE id = ?')
        .bind(sla.dueDate, now, data.leadId).run();
      await env.CRM_DB.prepare('INSERT INTO lead_events (id, lead_id, event_type, text, actor, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(
          crypto.randomUUID(),
          data.leadId,
          'sla_assigned',
          `SLA comercial automático definido para ${formatPtDate(sla.dueDate)} (${sla.label}).`,
          'Code Solution',
          JSON.stringify({ score, temperature: sla.temperature, dueDate: sla.dueDate, policy: sla.policy }),
          now,
        ).run();
    } else if (env.LEADS_KV) {
      const key = `lead:${data.leadId}`;
      const raw = await env.LEADS_KV.get(key);
      if (raw) {
        const lead = JSON.parse(raw);
        lead.nextActionDue = sla.dueDate;
        lead.updatedAt = now;
        lead.timeline = [...(Array.isArray(lead.timeline) ? lead.timeline : []), {
          at: now,
          type: 'sla_assigned',
          text: `SLA comercial automático definido para ${formatPtDate(sla.dueDate)} (${sla.label}).`,
        }].slice(-200);
        await env.LEADS_KV.put(key, JSON.stringify(lead));
      }
    }
    data.nextActionDue = sla.dueDate;
    data.sla = { label: sla.label, policy: sla.policy, temperature: sla.temperature };
  } catch (error) {
    console.warn('Could not assign automatic lead SLA.', String(error?.message || error));
  }

  return cloneJsonResponse(response, data);
}

function commercialSla(score) {
  const temperature = score >= 75 ? 'quente' : score >= 45 ? 'morno' : 'frio';
  const nowInfo = saoPauloParts(new Date());
  const today = saoPauloNoon(nowInfo.year, nowInfo.month, nowInfo.day);

  if (temperature === 'quente') {
    const due = (nowInfo.weekday === 'Sat' || nowInfo.weekday === 'Sun' || nowInfo.hour >= 16)
      ? nextBusinessDay(today)
      : today;
    return { temperature, dueDate: saoPauloDate(due), label: 'mesmo dia útil', policy: 'hot_same_business_day' };
  }

  if (temperature === 'morno') {
    const due = addBusinessDays(today, 1);
    return { temperature, dueDate: saoPauloDate(due), label: '1 dia útil', policy: 'warm_1_business_day' };
  }

  const due = addBusinessDays(today, 3);
  return { temperature, dueDate: saoPauloDate(due), label: '3 dias úteis', policy: 'cold_3_business_days' };
}

function addBusinessDays(date, days) {
  let cursor = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    cursor = addCalendarDay(cursor);
    if (!isWeekend(cursor)) remaining--;
  }
  return cursor;
}

function nextBusinessDay(date) {
  let cursor = addCalendarDay(date);
  while (isWeekend(cursor)) cursor = addCalendarDay(cursor);
  return cursor;
}

function addCalendarDay(date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function isWeekend(date) {
  const weekday = saoPauloParts(date).weekday;
  return weekday === 'Sat' || weekday === 'Sun';
}

function saoPauloNoon(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
}

function saoPauloParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday'),
    hour: Number(get('hour')),
  };
}

function saoPauloDate(date) {
  const p = saoPauloParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function formatPtDate(value) {
  const [year, month, day] = String(value).split('-');
  return `${day}/${month}/${year}`;
}

async function rebrandChatResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return response;
  const text = await response.text();
  const branded = text.replace(/\bCodi\b/g, 'Code Solution');
  return new Response(branded, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function cloneTextResponse(source, text) {
  return new Response(text, { status: source.status, statusText: source.statusText, headers: source.headers });
}

function cloneJsonResponse(source, data) {
  const headers = new Headers(source.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status: source.status, statusText: source.statusText, headers });
}

function extractMessage(result) {
  if (typeof result === 'string') return result.trim();
  if (typeof result?.response === 'string') return result.response.trim();
  if (typeof result?.result?.response === 'string') return result.result.response.trim();
  const content = result?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

function sanitizeLeadContext(input) {
  const out = {};
  const fields = ['name','whatsapp','email','company','segment','need','businessType','type','urgency','budget','source','campaign','medium','content','term','landingPage','referrer','notes','decisionMaker','consentAt'];
  for (const key of fields) {
    if (input[key] === undefined || input[key] === null) continue;
    if (typeof input[key] === 'boolean' || typeof input[key] === 'number') out[key] = input[key];
    else out[key] = String(input[key]).replace(/[<>]/g, '').trim().slice(0, 2000);
  }
  return out;
}

function normalizeMessage(message) {
  return {
    role: ['assistant','user'].includes(message?.role) ? message.role : 'user',
    content: String(message?.content || '').slice(0, 3000),
  };
}

function isBusinessHours() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return !['Sat','Sun'].includes(weekday) && hour >= 8 && hour < 18;
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || 'https://www.codesolution.com.br,https://codesolution.com.br')
    .split(',').map((x) => x.trim());
  const accepted = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'access-control-allow-origin': accepted,
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type,x-crm-key,authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function respond(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
