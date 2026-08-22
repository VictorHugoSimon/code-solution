const ATTENDANT = 'https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isPanel = url.pathname === '/painel' || url.pathname.startsWith('/painel/');

    if (isPanel) {
      const credentials = readBasicAuth(request.headers.get('authorization'));
      if (!credentials?.password || !(await validatePanelKey(credentials.password))) {
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
    }

    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (isPanel) {
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }
    return response;
  },
};

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
