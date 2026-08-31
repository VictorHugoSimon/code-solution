import baseRuntime from './autonomy-entry-runtime.js';

const MARKETING_WRITE_PREFIXES = [
  '/crm/acquisition/',
  '/crm/prospecting/',
  '/crm/growth',
];

const WHATSAPP_HEALTH_PATH = '/crm/notifications/whatsapp/health';
const WHATSAPP_TEST_PATH = '/crm/notifications/whatsapp/test';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === WHATSAPP_HEALTH_PATH && request.method === 'GET') {
      if (!authorizeAdmin(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
      return json({
        ok: true,
        configured: whatsappConfigured(env),
        tokenConfigured: Boolean(env.WHATSAPP_TOKEN),
        phoneIdConfigured: Boolean(env.WHATSAPP_PHONE_ID),
        recipientConfigured: Boolean(env.OWNER_WHATSAPP),
        templateConfigured: Boolean(env.WHATSAPP_ALERT_TEMPLATE),
        mode: env.WHATSAPP_ALERT_TEMPLATE ? 'template' : 'free_form_text',
        note: env.WHATSAPP_ALERT_TEMPLATE
          ? 'Template mode is suitable for proactive alerts outside the 24-hour service window.'
          : 'Free-form text depends on an open WhatsApp service window. Configure an approved template for reliable 24/7 alerts.',
      }, 200);
    }

    if (url.pathname === WHATSAPP_TEST_PATH && request.method === 'POST') {
      if (!authorizeAdmin(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
      if (!whatsappConfigured(env)) return json({ ok: false, error: 'whatsapp_not_configured' }, 503);
      try {
        const result = await sendWhatsAppAlert(env, [
          '✅ Teste de alertas Code Solution',
          '',
          'O canal de notificações do CRM e Marketing está funcionando.',
          `Horário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        ].join('\n'));
        return json({ ok: true, sent: true, mode: result.mode, messageId: result.messageId || '' }, 200);
      } catch (error) {
        return json({ ok: false, error: 'whatsapp_send_failed', detail: cleanError(error) }, 502);
      }
    }

    const isLeadCreate = url.pathname === '/lead' && request.method === 'POST';
    const isLeadPatch = /^\/crm\/lead\/[^/]+$/.test(url.pathname) && request.method === 'PATCH';
    const isMarketingWrite = isWriteMethod(request.method) && MARKETING_WRITE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

    let submitted = {};
    if (isLeadCreate || isLeadPatch || isMarketingWrite) {
      submitted = await readJson(request.clone());
    }

    const response = await baseRuntime.fetch(request, env, ctx);
    if (!response.ok) return response;

    if (isLeadCreate && response.status === 201) {
      const task = notifyNewLead(env, submitted, response.clone()).catch((error) => {
        console.warn('WhatsApp new lead alert failed', cleanError(error));
      });
      schedule(ctx, task);
      return response;
    }

    if (isLeadPatch) {
      const task = notifyLeadUpdated(env, submitted, response.clone()).catch((error) => {
        console.warn('WhatsApp lead update alert failed', cleanError(error));
      });
      schedule(ctx, task);
      return response;
    }

    if (isMarketingWrite) {
      const task = notifyMarketingAction(env, request.method, url, submitted).catch((error) => {
        console.warn('WhatsApp marketing action alert failed', cleanError(error));
      });
      schedule(ctx, task);
    }

    return response;
  },

  async scheduled(event, env, ctx) {
    if (typeof baseRuntime.scheduled === 'function') return baseRuntime.scheduled(event, env, ctx);
  },
};

async function notifyNewLead(env, submitted, response) {
  if (!whatsappConfigured(env)) return;
  let result = {};
  try { result = await response.json(); } catch { result = {}; }

  const message = [
    '🚨 NOVO LEAD · CODE SOLUTION',
    '',
    `Nome: ${clean(submitted.name || 'Não informado', 120)}`,
    `Empresa: ${clean(submitted.company || 'Não informada', 160)}`,
    `WhatsApp: ${clean(submitted.whatsapp || 'Não informado', 80)}`,
    `Segmento: ${clean(submitted.segment || 'Não informado', 120)}`,
    `Necessidade: ${clean(submitted.need || 'Não informada', 900)}`,
    `Origem: ${clean(submitted.source || 'site', 100)}`,
    `Score: ${Number(result.score || 0)}/100`,
    `Status: ${clean(result.status || 'novo', 80)}`,
    `Próxima ação: ${clean(result.nextAction || 'Ver CRM', 180)}`,
    '',
    'CRM: https://www.codesolution.com.br/painel/crm/',
  ].join('\n');

  return sendWhatsAppAlert(env, message);
}

async function notifyLeadUpdated(env, submitted, response) {
  if (!whatsappConfigured(env)) return;
  let result = {};
  try { result = await response.json(); } catch { result = {}; }
  const lead = result?.lead || {};
  const changed = Object.keys(submitted || {}).filter((key) => key !== 'timelineText');
  const important = changed.length ? changed.join(', ') : 'atualização no histórico';

  const message = [
    '🔔 LEAD ATUALIZADO · CODE SOLUTION',
    '',
    `Lead: ${clean(lead.name || lead.company || lead.id || 'Não identificado', 160)}`,
    `Alterações: ${clean(important, 400)}`,
    submitted.status !== undefined ? `Novo estágio: ${clean(submitted.status, 100)}` : '',
    submitted.nextAction !== undefined ? `Próxima ação: ${clean(submitted.nextAction, 240)}` : '',
    submitted.nextActionDue !== undefined ? `Prazo: ${clean(submitted.nextActionDue, 100)}` : '',
    submitted.owner !== undefined ? `Responsável: ${clean(submitted.owner || 'não definido', 120)}` : '',
    submitted.estimatedValue !== undefined ? `Valor estimado: ${formatCurrency(submitted.estimatedValue)}` : '',
    submitted.lossReason !== undefined ? `Motivo de perda: ${clean(submitted.lossReason, 300)}` : '',
    submitted.timelineText ? `Registro: ${clean(submitted.timelineText, 500)}` : '',
    '',
    'CRM: https://www.codesolution.com.br/painel/crm/',
  ].filter(Boolean).join('\n');

  return sendWhatsAppAlert(env, message);
}

async function notifyMarketingAction(env, method, url, submitted) {
  if (!whatsappConfigured(env)) return;
  const action = describeMarketingAction(url.pathname);
  const details = compactPayload(submitted);
  const message = [
    '📣 AÇÃO NO MARKETING · CODE SOLUTION',
    '',
    `Ação: ${action}`,
    `Operação: ${method}`,
    details ? `Detalhes: ${details}` : '',
    `Horário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    '',
    'Marketing: https://www.codesolution.com.br/painel/marketing/',
  ].filter(Boolean).join('\n');

  return sendWhatsAppAlert(env, message);
}

function describeMarketingAction(pathname) {
  if (/^\/crm\/acquisition\/goal\//.test(pathname)) return 'Meta de aquisição alterada';
  if (pathname.startsWith('/crm/acquisition/')) return 'Aquisição atualizada';
  if (pathname.startsWith('/crm/prospecting/')) return 'Prospecção atualizada';
  if (pathname.startsWith('/crm/growth')) return 'Growth/Marketing atualizado';
  return 'Ação operacional de Marketing';
}

async function sendWhatsAppAlert(env, message) {
  if (!whatsappConfigured(env)) throw new Error('whatsapp_not_configured');
  const to = String(env.OWNER_WHATSAPP || '').replace(/\D/g, '');
  if (to.length < 10) throw new Error('invalid_owner_whatsapp');

  const graphVersion = String(env.WHATSAPP_GRAPH_VERSION || 'v23.0').replace(/[^v0-9.]/g, '') || 'v23.0';
  const endpoint = `https://graph.facebook.com/${graphVersion}/${env.WHATSAPP_PHONE_ID}/messages`;
  const templateName = String(env.WHATSAPP_ALERT_TEMPLATE || '').trim();
  const languageCode = String(env.WHATSAPP_ALERT_TEMPLATE_LANGUAGE || 'pt_BR').trim() || 'pt_BR';

  const payload = templateName
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: 'body', parameters: [{ type: 'text', text: clean(message, 3500) }] }],
        },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: clean(message, 3500) },
      };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`meta_whatsapp_${response.status}:${body.slice(0, 350)}`);
  let data = {};
  try { data = JSON.parse(body); } catch { data = {}; }
  return { mode: templateName ? 'template' : 'free_form_text', messageId: data?.messages?.[0]?.id || '' };
}

function whatsappConfigured(env) {
  return Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.OWNER_WHATSAPP);
}

function authorizeAdmin(request, env) {
  const expected = String(env.CRM_ADMIN_KEY || '');
  if (!expected) return false;
  const provided = request.headers.get('x-crm-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return safeEqual(String(provided), expected);
}

function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a || ''));
  const y = new TextEncoder().encode(String(b || ''));
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function compactPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return '';
  const blocked = new Set(['password', 'token', 'secret', 'authorization', 'crmAdminKey']);
  const parts = [];
  for (const [key, value] of Object.entries(input)) {
    if (blocked.has(key) || value === undefined || value === null || value === '') continue;
    const rendered = typeof value === 'object' ? JSON.stringify(value) : String(value);
    parts.push(`${key}=${clean(rendered, 180)}`);
    if (parts.length >= 8) break;
  }
  return clean(parts.join(' · '), 1200);
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return clean(value, 100);
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isWriteMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function schedule(ctx, task) {
  if (ctx?.waitUntil) ctx.waitUntil(task);
  else return task;
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function clean(value, max = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanError(error) {
  return clean(error?.message || error || 'unknown_error', 500);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
