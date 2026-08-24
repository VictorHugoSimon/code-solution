import baseWorker from './atendente-worker.js';

const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const RUNTIME_BUILD = 'codi-workers-ai-2026-08-24.1';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/chat' || request.method !== 'POST' || !env.AI || typeof env.AI.run !== 'function') {
      return baseWorker.fetch(request, env, ctx);
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
      const system = `Você é Codi, atendente consultivo da Code Solution. Fale em português do Brasil, com clareza e objetividade. Seu objetivo é entender a dor, identificar se é demanda empresarial, descobrir segmento e coletar nome + WhatsApp. Nunca invente preço, prazo ou capacidade. Quando houver dados suficientes, proponha uma próxima ação simples: diagnóstico/discovery com a equipe. Se a pessoa pedir atendimento humano, confirme a solicitação e não finja ser uma pessoa. Não peça dados sensíveis. Contexto já coletado: ${JSON.stringify(context)}.`;

      const result = await env.AI.run(env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL, {
        messages: [{ role: 'system', content: system }, ...messages.map(normalizeMessage)],
        temperature: 0.35,
        max_tokens: 500,
      });

      let message = extractMessage(result);
      if (!message) throw new Error('workers_ai_empty_response');
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
      return baseWorker.fetch(fallbackRequest, env, ctx);
    }
  },
};

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
