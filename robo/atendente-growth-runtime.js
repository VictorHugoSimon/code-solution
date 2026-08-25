import attendantRuntime from './atendente-worker-runtime.js';
import { handleGrowthApi } from './growth-api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/crm/growth')) {
      return handleGrowthApi(request, env, corsHeaders(request, env));
    }
    return attendantRuntime.fetch(request, env, ctx);
  },
};

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
