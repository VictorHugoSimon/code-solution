import fs from 'node:fs/promises';

const file = 'deploy/_worker.js';
let source = await fs.readFile(file, 'utf8');
const MARKER = 'PANEL-ACCESS-ENHANCEMENTS:2026-08-25';
if (source.includes(MARKER)) {
  console.log('Panel access enhancements already applied.');
  process.exit(0);
}

source = source.replace(
  "function panelAllowed(pathname, permissions) {\n  const p = new Set(permissions);\n  if (pathname === '/painel' || pathname === '/painel/') return p.has('overview');",
  `function panelAllowed(pathname, permissions) {\n  const p = new Set(permissions);\n  if (pathname.startsWith('/painel/conta')) return true;\n  if (pathname === '/painel' || pathname === '/painel/') return p.has('overview');`,
);

source = source.replace(
  "  const data = await response.json().catch(() => ({}));\n  if (!response.ok || data.ok !== true || !data.token) {\n    return loginPage({status:401,error:'Usuário ou senha inválidos. Verifique as credenciais e tente novamente.',next:destination,username});\n  }",
  `  const data = await response.json().catch(() => ({}));\n  if (response.status === 429) {\n    const retry = Number(data.retryAfterSeconds || response.headers.get('retry-after') || 900);\n    const minutes = Math.max(1, Math.ceil(retry / 60));\n    return loginPage({status:429,error:\`Muitas tentativas de acesso. Aguarde aproximadamente \${minutes} minuto(s) e tente novamente.\`,next:destination,username});\n  }\n  if (!response.ok || data.ok !== true || !data.token) {\n    return loginPage({status:401,error:'Usuário ou senha inválidos. Verifique as credenciais e tente novamente.',next:destination,username});\n  }`,
);

source = source.replace(
  "async function withPanelIdentity(source,session) {\n  let html=await source.text();",
  `async function withPanelIdentity(source,session) {\n  let html=await source.text();\n  html=filterPanelNavigation(html,session.permissions||[]);`,
);

source = source.replace(
  "  const users=session.permissions.includes('users')?'<a href=\"/painel/usuarios/\" style=\"color:#9ed7ff;text-decoration:none\">Usuários</a> · ':'';\n  const bar=`<div style=\"position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#0b1d2d;color:#fff;border:1px solid #31506b;border-radius:999px;padding:9px 13px;font:600 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.25)\">${user} · ${role} · ${users}<a href=\"/painel/logout/\" style=\"color:#9ed7ff;text-decoration:none\">Sair</a></div>`;",
  "  const users=session.permissions.includes('users')?'<a href=\"/painel/usuarios/\" style=\"color:#9ed7ff;text-decoration:none\">Usuários</a> · ':'';\n  const account='<a href=\"/painel/conta/\" style=\"color:#9ed7ff;text-decoration:none\">Minha conta</a> · ';\n  const bar=`<div style=\"position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#0b1d2d;color:#fff;border:1px solid #31506b;border-radius:999px;padding:9px 13px;font:600 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.25)\">${user} · ${role} · ${users}${account}<a href=\"/painel/logout/\" style=\"color:#9ed7ff;text-decoration:none\">Sair</a></div>`;",
);

const helper = `\n// ${MARKER}\nfunction filterPanelNavigation(html,permissions){\n  const p=new Set(permissions||[]);\n  const rules=[\n    ['/painel/crm/','crm_read'],\n    ['/painel/atendimento/','attendance'],\n    ['/painel/agenda/','agenda'],\n    ['/painel/prospeccao/','prospecting'],\n    ['/painel/marketing/','marketing'],\n    ['/painel/inteligencia/','intelligence'],\n    ['/painel/growth/','growth'],\n    ['/painel/relatorios/','reports'],\n    ['/painel/usuarios/','users'],\n  ];\n  let out=html;\n  for(const [href,permission] of rules){\n    if(p.has(permission)) continue;\n    const pattern='<a\\\\b[^>]*href=[\"\\\\\']'+href+'[\"\\\\\'][^>]*>[\\\\s\\\\S]*?<\\\\/a>';\n    out=out.replace(new RegExp(pattern,'gi'),'');\n  }\n  return out;\n}\n`;

source = source.replace('\nfunction roleLabel(role)', `${helper}\nfunction roleLabel(role)`);

if (!source.includes(MARKER) || !source.includes("pathname.startsWith('/painel/conta')") || !source.includes('filterPanelNavigation')) {
  throw new Error('Failed to apply panel access enhancements safely.');
}

await fs.writeFile(file, source);
console.log('Panel access enhancements applied: account access, lockout feedback and role-aware navigation.');
