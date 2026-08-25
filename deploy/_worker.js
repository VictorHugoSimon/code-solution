const ATTENDANT = 'https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev';
const CANONICAL_HOST = 'www.codesolution.com.br';
const SESSION_COOKIE = 'cs_panel_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;







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







    if (url.pathname === '/painel/login' || url.pathname === '/painel/login/') return handleLogin(request, url);
    if (url.pathname === '/painel/logout' || url.pathname === '/painel/logout/') return handleLogout(request, url);

    const isPanel = url.pathname === '/painel' || url.pathname.startsWith('/painel/');
    const isCrmApi = url.pathname === '/api/crm' || url.pathname.startsWith('/api/crm/');
    const isAuthApi = url.pathname === '/api/auth' || url.pathname.startsWith('/api/auth/');

    let session = null;
    if (isPanel || isCrmApi || isAuthApi) {
      session = await resolveSession(request);
      if (!session) {
        if (isCrmApi || isAuthApi) return json({ ok:false, error:'unauthorized' }, 401, true);
        return redirectToLogin(url);
      }
    }

    if (isPanel && !panelAllowed(url.pathname, session.permissions || [])) return forbiddenPage(session.user);

    if (isCrmApi) {
      if (!env.CRM_ADMIN_KEY) return json({ ok:false, error:'panel_not_configured' }, 503, true);
      const canRead = hasPermission(session, 'crm_read');
      const canWrite = hasPermission(session, 'crm_write');
      if (!canRead || (!['GET','HEAD'].includes(request.method) && !canWrite)) return json({ok:false,error:'forbidden'},403,true);
      return proxyCrm(request, url, env.CRM_ADMIN_KEY);
    }

    if (isAuthApi) return proxyAuth(request, url, session.token);

    const asset = await env.ASSETS.fetch(request);
    return secureResponse(asset, { panel:isPanel, session });
  },
};

async function handleLogin(request, url) {
  const existing = await resolveSession(request);
  if (existing) return Response.redirect(`${url.origin}/painel/`, 302);
  const next = sanitizeNext(url.searchParams.get('next'));
  if (request.method === 'GET' || request.method === 'HEAD') return loginPage({ next });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status:405 });

  const form = await request.formData().catch(() => null);
  const username = String(form?.get('username') || '').trim();
  const password = String(form?.get('password') || '');
  const destination = sanitizeNext(form?.get('next')) || next || '/painel/';
  if (!username || !password) return loginPage({status:401,error:'Informe usuário e senha.',next:destination,username});

  let response;
  try {
    response = await fetch(`${ATTENDANT}/auth/login`, {
      method:'POST',
      headers:{'content-type':'application/json','origin':'https://www.codesolution.com.br'},
      body:JSON.stringify({username,password}),
      cf:{cacheTtl:0},
    });
  } catch {
    return loginPage({status:503,error:'Serviço de autenticação temporariamente indisponível.',next:destination,username});
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true || !data.token) {
    return loginPage({status:401,error:'Usuário ou senha inválidos. Verifique as credenciais e tente novamente.',next:destination,username});
  }
  const allowedDestination = panelAllowed(new URL(destination, url.origin).pathname, data.permissions || []) ? destination : '/painel/';
  return new Response(null, {
    status:303,
    headers:{
      Location:allowedDestination,
      'Set-Cookie':`${SESSION_COOKIE}=${data.token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
      'Cache-Control':'no-store',
      'X-Robots-Tag':'noindex, nofollow, noarchive',
    },
  });
}

async function handleLogout(request, url) {
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  if (token) await fetch(`${ATTENDANT}/auth/logout`, {method:'POST',headers:{authorization:`Bearer ${token}`},cf:{cacheTtl:0}}).catch(() => {});
  return new Response(null, {
    status:303,
    headers:{Location:`${url.origin}/painel/login/`,'Set-Cookie':`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'},
  });
}

async function resolveSession(request) {
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  if (!token) return null;
  try {
    const response = await fetch(`${ATTENDANT}/auth/session`, {headers:{authorization:`Bearer ${token}`},cf:{cacheTtl:0}});
    if (!response.ok) return null;
    const data = await response.json();
    if (data.ok !== true || !data.user) return null;
    return {token,user:data.user,permissions:Array.isArray(data.permissions)?data.permissions:[]};
  } catch { return null; }
}

function panelAllowed(pathname, permissions) {
  const p = new Set(permissions);
  if (pathname === '/painel' || pathname === '/painel/') return p.has('overview');
  if (pathname.startsWith('/painel/usuarios')) return p.has('users');
  if (pathname.startsWith('/painel/crm')) return p.has('crm_read');
  if (pathname.startsWith('/painel/atendimento')) return p.has('attendance');
  if (pathname.startsWith('/painel/agenda')) return p.has('agenda');
  if (pathname.startsWith('/painel/prospeccao')) return p.has('prospecting');
  if (pathname.startsWith('/painel/marketing')) return p.has('marketing');
  if (pathname.startsWith('/painel/inteligencia')) return p.has('intelligence');
  if (pathname.startsWith('/painel/growth')) return p.has('growth');
  if (pathname.startsWith('/painel/relatorios')) return p.has('reports');
  return false;
}
function hasPermission(session, permission) { return Boolean(session?.permissions?.includes(permission)); }

async function proxyCrm(request, incomingUrl, key) {
  const path = incomingUrl.pathname.replace(/^\/api\/crm/, '/crm') || '/crm';
  const upstream = new URL(path + incomingUrl.search, ATTENDANT);
  const headers = new Headers({'x-crm-key':key});
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const init = {method:request.method,headers,redirect:'manual'};
  if (!['GET','HEAD'].includes(request.method)) init.body = request.body;
  const response = await fetch(upstream, init);
  return secureResponse(response,{panel:true});
}

async function proxyAuth(request, incomingUrl, token) {
  const path = incomingUrl.pathname.replace(/^\/api\/auth/, '/auth') || '/auth/session';
  const upstream = new URL(path + incomingUrl.search, ATTENDANT);
  const headers = new Headers({authorization:`Bearer ${token}`});
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type',contentType);
  const init={method:request.method,headers,redirect:'manual'};
  if(!['GET','HEAD'].includes(request.method)) init.body=request.body;
  const response=await fetch(upstream,init);
  return secureResponse(response,{panel:true});
}

function redirectToLogin(url) {
  const next=encodeURIComponent(url.pathname+url.search);
  return Response.redirect(`${url.origin}/painel/login/?next=${next}`,302);
}

function forbiddenPage(user) {
  const name=escapeHtml(user?.displayName||user?.username||'Usuário');
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Acesso restrito | Code Solution</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07121d;color:#fff;font-family:system-ui;padding:24px}.card{max-width:520px;background:#0b1d2d;border:1px solid #29465f;border-radius:18px;padding:28px}a{color:#85ceff}</style></head><body><main class="card"><h1>Acesso restrito</h1><p>${name}, seu perfil não possui permissão para este módulo.</p><p><a href="/painel/">Voltar ao painel</a> · <a href="/painel/logout/">Sair</a></p></main></body></html>`,{status:403,headers:panelHeaders('text/html; charset=utf-8')});
}

function loginPage({status=200,error='',next='',username='admin'}={}) {
  const safeError=escapeHtml(error), safeNext=escapeHtml(next||'/painel/'), safeUsername=escapeHtml(username||'admin');
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Acesso ao CRM | Code Solution</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#16304a 0,#09131f 46%,#050b12 100%);font-family:Inter,system-ui,sans-serif;color:#f7fbff;padding:24px}.card{width:min(440px,100%);background:rgba(8,20,32,.94);border:1px solid rgba(118,188,255,.2);border-radius:22px;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.38)}.brand{display:flex;align-items:center;gap:12px;font-weight:800;margin-bottom:28px}.mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#35a7ff,#5de0b7);color:#06131e}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:#7dc6ff;margin-bottom:8px}h1{font-size:28px;margin:0 0 10px}p{color:#aebfce;line-height:1.55}.field{display:grid;gap:8px;margin-bottom:16px}label{font-size:13px;font-weight:700}input{width:100%;border:1px solid #29465f;background:#081521;color:#fff;border-radius:12px;padding:14px;font-size:16px;outline:none}input:focus{border-color:#5bbcff;box-shadow:0 0 0 3px rgba(91,188,255,.13)}button{width:100%;border:0;border-radius:12px;padding:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#4ab4ff,#58d7b2);color:#05111b}.error{padding:12px 14px;border-radius:10px;margin-bottom:16px;background:rgba(255,92,92,.12);border:1px solid rgba(255,92,92,.35);color:#ffb4b4;font-size:13px}.meta{margin-top:18px;font-size:12px;color:#7890a4;text-align:center}.meta a{color:#9ed7ff}</style></head><body><main class="card"><div class="brand"><div class="mark">CS</div><span>Code Solution</span></div><div class="eyebrow">Área administrativa</div><h1>Acesso ao CRM</h1><p>Entre com sua identidade individual para acessar os módulos permitidos ao seu perfil.</p>${safeError?`<div class="error" role="alert">${safeError}</div>`:''}<form method="post" action="/painel/login/" autocomplete="on"><input type="hidden" name="next" value="${safeNext}"><div class="field"><label for="username">Usuário</label><input id="username" name="username" type="text" autocomplete="username" value="${safeUsername}" required autofocus></div><div class="field"><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button type="submit">Entrar no CRM</button></form><div class="meta">Sessão individual e revogável · <a href="/">Voltar ao site</a></div></main></body></html>`;
  return new Response(html,{status,headers:panelHeaders('text/html; charset=utf-8')});
}

function secureResponse(source,{panel=false,session=null}={}) {
  const contentType=source.headers.get('content-type')||'';
  if(panel && session && contentType.includes('text/html')) return withPanelIdentity(source,session);
  const response=new Response(source.body,source); setSecurityHeaders(response,panel); return response;
}

async function withPanelIdentity(source,session) {
  let html=await source.text();
  const user=escapeHtml(session.user?.displayName||session.user?.username||'Usuário');
  const role=escapeHtml(roleLabel(session.user?.role));
  const users=session.permissions.includes('users')?'<a href="/painel/usuarios/" style="color:#9ed7ff;text-decoration:none">Usuários</a> · ':'';
  const bar=`<div style="position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#0b1d2d;color:#fff;border:1px solid #31506b;border-radius:999px;padding:9px 13px;font:600 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.25)">${user} · ${role} · ${users}<a href="/painel/logout/" style="color:#9ed7ff;text-decoration:none">Sair</a></div>`;
  html=html.includes('</body>')?html.replace('</body>',`${bar}</body>`):`${html}${bar}`;
  const response=new Response(html,source); setSecurityHeaders(response,true); return response;
}

function roleLabel(role){return({admin:'Administrador',comercial:'Comercial',marketing:'Marketing',leitura_executiva:'Leitura Executiva'})[role]||role||'Usuário';}
function panelHeaders(contentType){return {'Content-Type':contentType,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'Strict-Transport-Security':'max-age=31536000; includeSubDomains'};}
function setSecurityHeaders(response,panel){response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');response.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');if(panel){response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');}}
function json(data,status=200,panel=false){const response=new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});setSecurityHeaders(response,panel);return response;}
function readCookie(header,name){if(!header)return'';for(const part of header.split(';')){const i=part.indexOf('=');if(i<0)continue;if(part.slice(0,i).trim()===name)return part.slice(i+1).trim();}return'';}
function sanitizeNext(value){const next=String(value||'').trim();if(!next.startsWith('/painel/')||next.startsWith('//'))return'';if(next.startsWith('/painel/login')||next.startsWith('/painel/logout'))return'';return next.slice(0,500);}
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
