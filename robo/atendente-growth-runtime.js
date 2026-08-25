import attendantRuntime from './atendente-worker-runtime.js';
import { handleGrowthApi } from './growth-api.js';
import { handleCommercialApi, afterLeadCreated, beforeLeadPatch, afterLeadPatched, runCommercialAutomation } from './crm-automation.js';

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
  'lead_submit_success',
  'case_view',
  'case_cta_click',
  'scroll_50',
  'scroll_90',
  'outbound_click',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (url.pathname.startsWith('/crm/growth')) {
      return handleGrowthApi(request, env, cors);
    }

    if (
      url.pathname.startsWith('/crm/operations') ||
      url.pathname.startsWith('/crm/acquisition') ||
      url.pathname === '/crm/alerts' ||
      /^\/crm\/alert\/[^/]+$/.test(url.pathname) ||
      url.pathname === '/crm/tasks' ||
      /^\/crm\/task\/[^/]+$/.test(url.pathname) ||
      url.pathname === '/crm/owners' ||
      /^\/crm\/owner\/[^/]+$/.test(url.pathname) ||
      url.pathname === '/crm/automation/run'
    ) {
      const response = await handleCommercialApi(request, env, cors);
      if (response) return response;
    }

    if (url.pathname === '/event') return handleAcquisitionEvent(request, env);

    if (url.pathname === '/lead' && request.method === 'POST') {
      const payload = await readJson(request.clone());
      const response = await attendantRuntime.fetch(request, env, ctx);
      if (response.status === 201) {
        try {
          const data = await response.clone().json();
          ctx?.waitUntil?.(afterLeadCreated(env, {
            leadId: data?.leadId,
            sessionId: payload?.sessionId,
            source: payload?.source,
            medium: payload?.medium,
            campaign: payload?.campaign,
            landingPage: payload?.landingPage,
          }));
        } catch (error) {
          console.warn('Lead automation post-processing failed.', String(error?.message || error));
        }
      }
      return response;
    }

    if (/^\/crm\/lead\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') {
      const leadId = decodeURIComponent(url.pathname.split('/').pop());
      const before = await beforeLeadPatch(env, leadId).catch(() => null);
      const response = await attendantRuntime.fetch(request, env, ctx);
      if (response.ok && before) {
        try {
          const data = await response.clone().json();
          ctx?.waitUntil?.(afterLeadPatched(env, before, data, 'painel'));
        } catch (error) {
          console.warn('Lead patch automation post-processing failed.', String(error?.message || error));
        }
      }
      return response;
    }

    return attendantRuntime.fetch(request, env, ctx);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runCommercialAutomation(env, { trigger:'scheduled_30m', notify:true }));
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
  const allowed = ['label','target','placement','channel','article','depth','case'];
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

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
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
