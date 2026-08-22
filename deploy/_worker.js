const ATTENDANT = 'https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isPanel = url.pathname === '/painel' || url.pathname.startsWith('/painel/');
    const isCrmApi = url.pathname === '/api/crm' || url.pathname.startsWith('/api/crm/');

    let credentials = null;
    if (isPanel || isCrmApi) {
      credentials = readBasicAuth(request.headers.get('authorization'));
      if (!credentials?.password || !(await validatePanelKey(credentials.password))) {
        return unauthorized();
      }
    }

    if (isCrmApi) {
      return proxyCrm(request, url, credentials.password);
    }

    const asset = await env.ASSETS.fetch(request);
    return secureResponse(asset, { panel: isPanel });
  },
};

function unauthorized() {
  return new Response('Autenticação necessária para acessar o painel Code Solution.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Code Solution Painel", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function proxyCrm(request, incomingUrl, key) {
  const upstreamPath = incomingUrl.pathname.replace(/^\/api\/crm/, '/crm') || '/crm';
  const upstream = new URL(upstreamPath + incomingUrl.search, ATTENDANT);
  const headers = new Headers();
  headers.set('x-crm-key', key);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const init = { method: request.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;

  const response = await fetch(upstream, init);
  return secureResponse(response, { panel: true });
}

function secureResponse(source, { panel = false } = {}) {
  const response = new Response(source.body, source);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (panel) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}

function readBasicAuth(header) {
  if (!header || !header.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

async function validatePanelKey(key) {
  try {
    const response = await fetch(`${ATTENDANT}/crm/summary`, {
      headers: { 'x-crm-key': key },
      cf: { cacheTtl: 0 },
    });
    return response.ok;
  } catch {
    return false;
  }
}
