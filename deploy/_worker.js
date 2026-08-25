const ATTENDANT = 'https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev';
const CANONICAL_HOST = 'www.codesolution.com.br';
const SESSION_COOKIE = 'cs_panel_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const LOGIN_USERNAME = 'admin';
const LOGIN_PASSWORD_SHA256 = 'c4467ec1a165ac8214bb31db4fffdc45e8ea0612e8e2e696f2cc701de9a5a325';
// SEO-LEGACY-MIGRATION:START
const LEGACY_REDIRECTS = new Map([
  ['/portfolio-category/website/','/servicos/'],
  ['/portfolio/apple-3d-design/','/servicos/'],
  ['/portfolio/illustration-visual-design/','/servicos/'],
  ['/a-guide-for-businesses-in-the-digital-age/','/blog/'],
  ['/the-art-of-crafting-compelling-brand-stories/','/blog/'],
  ['/how-analytics-can-drive-business-success/','/blog/'],
]);
function legacyRedirectFor(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  if (LEGACY_REDIRECTS.has(normalized)) return LEGACY_REDIRECTS.get(normalized);
  if (/^\/portfolio(?:-category)?\//i.test(normalized)) return '/servicos/';
  if (/^\/(?:author|category|tag)\//i.test(normalized)) return '/blog/';
  return '';
}
// SEO-LEGACY-MIGRATION:END

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'codesolution.com.br') {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const legacyTarget = legacyRedirectFor(url.pathname);
    if (legacyTarget) return Response.redirect(new URL(legacyTarget, url.origin).toString(), 301);
    // SEO-LEGACY-ROUTE:END

    if (url.pathname === '/painel/login' || url.pathname === '/painel/login/') {
      return handleLogin(request, env, url);
    }

    if (url.pathname === '/painel/logout' || url.pathname === '/painel/logout/') {
      return logout(url);
    }

    const isPanel = url.pathname === '/painel' || url.pathname.startsWith('/painel/');
    const isCrmApi = url.pathname === '/api/crm' || url.pathname.startsWith('/api/crm/');

    if (isPanel || isCrmApi) {
      const authenticated = await hasValidSession(request, env);
      if (!authenticated) {
        if (isCrmApi) return json({ ok: false, error: 'unauthorized' }, 401, true);
        const next = encodeURIComponent(url.pathname + url.search);
        return Response.redirect(`${url.origin}/painel/login/?next=${next}`, 302);
      }
    }

    if (isCrmApi) {
      if (!env.CRM_ADMIN_KEY) return json({ ok: false, error: 'panel_not_configured' }, 503, true);
      return proxyCrm(request, url, env.CRM_ADMIN_KEY);
    }

    const asset = await env.ASSETS.fetch(request);
    return secureResponse(asset, { panel: isPanel, injectLogout: isPanel });
  },
};

async function handleLogin(request, env, url) {
  if (!env.CRM_ADMIN_KEY) {
    return loginPage({
      status: 503,
      error: 'Acesso administrativo ainda não está configurado no ambiente de produção.',
      next: sanitizeNext(url.searchParams.get('next')),
    });
  }

  if (await hasValidSession(request, env)) {
    return Response.redirect(`${url.origin}/painel/crm/`, 302);
  }

  const next = sanitizeNext(url.searchParams.get('next'));
  if (request.method === 'GET' || request.method === 'HEAD') return loginPage({ next });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const form = await request.formData().catch(() => null);
  const username = String(form?.get('username') || '').trim();
  const password = String(form?.get('password') || '');
  const formNext = sanitizeNext(form?.get('next')) || next;

  const usernameOk = constantTimeEqual(username.toLowerCase(), LOGIN_USERNAME);
  const passwordOk = password ? constantTimeEqual(await sha256Hex(password), LOGIN_PASSWORD_SHA256) : false;

  if (!usernameOk || !passwordOk) {
    return loginPage({ status: 401, error: 'Usuário ou senha inválidos. Verifique as credenciais e tente novamente.', next: formNext, username });
  }

  const token = await createSession(env.CRM_ADMIN_KEY);
  const destination = formNext || '/painel/crm/';
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination,
      'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

function logout(url) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${url.origin}/painel/login/`,
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

function loginPage({ status = 200, error = '', next = '', username = 'admin' } = {}) {
  const safeError = escapeHtml(error);
  const safeNext = escapeHtml(next || '/painel/crm/');
  const safeUsername = escapeHtml(username || 'admin');
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Acesso ao CRM | Code Solution</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#16304a 0,#09131f 46%,#050b12 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7fbff;padding:24px}.card{width:min(440px,100%);background:rgba(8,20,32,.92);border:1px solid rgba(118,188,255,.2);border-radius:22px;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.38);backdrop-filter:blur(16px)}.brand{display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.02em;margin-bottom:28px}.mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#35a7ff,#5de0b7);color:#06131e;font-size:20px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:#7dc6ff;margin-bottom:8px}h1{font-size:28px;line-height:1.12;margin:0 0 10px}p{margin:0 0 24px;color:#aebfce;line-height:1.55}.field{display:grid;gap:8px;margin-bottom:16px}label{font-size:13px;font-weight:700;color:#dcebf6}input{width:100%;border:1px solid #29465f;background:#081521;color:#fff;border-radius:12px;padding:14px 15px;font-size:16px;outline:none}input:focus{border-color:#5bbcff;box-shadow:0 0 0 3px rgba(91,188,255,.13)}button{width:100%;border:0;border-radius:12px;padding:14px 16px;font-size:15px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#4ab4ff,#58d7b2);color:#05111b}.error{padding:12px 14px;border-radius:10px;margin-bottom:16px;background:rgba(255,92,92,.12);border:1px solid rgba(255,92,92,.35);color:#ffb4b4;font-size:13px}.meta{margin-top:18px;font-size:12px;color:#7890a4;text-align:center}.meta a{color:#9ed7ff;text-decoration:none}</style>
</head>
<body>
<main class="card">
  <div class="brand"><div class="mark">CS</div><span>Code Solution</span></div>
  <div class="eyebrow">Área administrativa</div>
  <h1>Acesso ao CRM</h1>
  <p>Entre com seu usuário e senha para acessar leads, pipeline e acompanhamento comercial.</p>
  ${safeError ? `<div class="error" role="alert">${safeError}</div>` : ''}
  <form method="post" action="/painel/login/" autocomplete="on">
    <input type="hidden" name="next" value="${safeNext}">
    <div class="field">
      <label for="username">Usuário</label>
      <input id="username" name="username" type="text" autocomplete="username" value="${safeUsername}" required autofocus>
    </div>
    <div class="field">
      <label for="password">Senha</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
    </div>
    <button type="submit">Entrar no CRM</button>
  </form>
  <div class="meta">Sessão protegida por até 8 horas · <a href="/">Voltar ao site</a></div>
</main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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

async function hasValidSession(request, env) {
  if (!env.CRM_ADMIN_KEY) return false;
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  if (!token) return false;
  return verifySession(token, env.CRM_ADMIN_KEY);
}

async function createSession(secret) {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, v: 1 });
  const encoded = base64UrlEncode(new TextEncoder().encode(payload));
  const signature = await sign(encoded, secret);
  return `${encoded}.${signature}`;
}

async function verifySession(token, secret) {
  try {
    const [encoded, signature] = String(token).split('.');
    if (!encoded || !signature) return false;
    const expected = await sign(encoded, secret);
    if (!constantTimeEqual(signature, expected)) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
    return payload?.v === 1 && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(bytes));
}

async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function readCookie(header, name) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return '';
}

function sanitizeNext(value) {
  const next = String(value || '').trim();
  if (!next.startsWith('/painel/') || next.startsWith('//')) return '';
  if (next.startsWith('/painel/login') || next.startsWith('/painel/logout')) return '';
  return next.slice(0, 500);
}

function constantTimeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function secureResponse(source, { panel = false, injectLogout = false } = {}) {
  const contentType = source.headers.get('content-type') || '';
  if (injectLogout && contentType.includes('text/html')) {
    return withLogout(source, panel);
  }
  const response = new Response(source.body, source);
  setSecurityHeaders(response, panel);
  return response;
}

async function withLogout(source, panel) {
  let html = await source.text();
  const button = '<a href="/painel/logout/" aria-label="Sair do painel" style="position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#0b1d2d;color:#fff;border:1px solid #31506b;border-radius:999px;padding:9px 13px;font:600 12px system-ui;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.25)">Sair</a>';
  html = html.includes('</body>') ? html.replace('</body>', `${button}</body>`) : `${html}${button}`;
  const response = new Response(html, source);
  setSecurityHeaders(response, panel);
  return response;
}

function setSecurityHeaders(response, panel) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (panel) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
}

function json(data, status = 200, panel = false) {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  setSecurityHeaders(response, panel);
  return response;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}
