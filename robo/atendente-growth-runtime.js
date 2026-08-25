import attendantRuntime from './atendente-worker-runtime.js';
import { handleGrowthApi } from './growth-api.js';

const EVENT_NAMES = new Set([
  'organic_landing_view',
  'cta_click',
  'whatsapp_click',
  'assistant_open',
  'diagnostic_open',
  'calculator_open',
  'blog_view',
  'blog_cta_click',
  'lead_form_start',
  'scroll_50',
  'scroll_90',
  'outbound_click',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/crm/growth')) {
      return handleGrowthApi(request, env, corsHeaders(request, env));
    }
    if (url.pathname === '/event') {
      return handleAcquisitionEvent(request, env);
    }
    return attendantRuntime.fetch(request, env, ctx);
  },
};

async function handleAcquisitionEvent(request, env) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
  if (!env.CRM_DB) return json({ ok: false, error: 'storage_not_configured' }, 503, cors);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 8192) return json({ ok: false, error: 'payload_too_large' }, 413, cors);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400, cors); }

  const eventName = clean(body?.eventName, 60);
  const sessionId = clean(body?.sessionId, 80);
  if (!EVENT_NAMES.has(eventName)) return json({ ok: false, error: 'invalid_event' }, 400, cors);
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(sessionId)) return json({ ok: false, error: 'invalid_session' }, 400, cors);

  const metadata = sanitizeMetadata(body?.metadata);
  const now = new Date().toISOString();
  await env.CRM_DB.prepare(`INSERT INTO acquisition_events
    (id,session_id,event_name,page_path,source,medium,campaign,referrer_host,metadata_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(
      crypto.randomUUID(), sessionId, eventName,
      safePath(body?.pagePath), clean(body?.source, 100) || null,
      clean(body?.medium, 100) || null, clean(body?.campaign, 160) || null,
      safeHost(body?.referrerHost), JSON.stringify(metadata).slice(0, 2500), now,
    ).run();

  return json({ ok: true }, 202, cors);
}

function sanitizeMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const allowed = ['label','target','placement','channel','article','depth'];
  const output = {};
  for (const key of allowed) {
    if (input[key] === undefined || input[key] === null) continue;
    output[key] = clean(input[key], 240);
  }
  return output;
}

function safePath(value) {
  const text = clean(value, 500);
  if (!text.startsWith('/')) return null;
  return text.split('?')[0].split('#')[0].slice(0, 300);
}

function safeHost(value) {
  const text = clean(value, 240).toLowerCase();
  if (!text) return null;
  return /^[a-z0-9.-]+(?::\d+)?$/.test(text) ? text : null;
}

function clean(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || 'https://www.codesolution.com.br,https://codesolution.com.br')
    .split(',').map((x) => x.trim()).filter(Boolean);
  const accepted = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'access-control-allow-origin': accepted,
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type,x-crm-key,authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
