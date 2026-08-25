import fs from 'node:fs/promises';

const files = [
  'deploy/painel/crm/index.html',
  'deploy/painel/marketing/index.html',
  'deploy/painel/inteligencia/index.html',
  'deploy/painel/atendimento/index.html',
  'deploy/painel/prospeccao/index.html',
  'deploy/painel/relatorios/index.html',
];

const links = [
  ['/painel/', 'Visão', 'visao'],
  ['/painel/crm/', 'CRM', 'crm'],
  ['/painel/atendimento/', 'Atendimento', 'atendimento'],
  ['/painel/prospeccao/', 'Prospecção', 'prospeccao'],
  ['/painel/marketing/', 'Marketing', 'marketing'],
  ['/painel/inteligencia/', 'Inteligência', 'inteligencia'],
  ['/painel/relatorios/', 'Relatórios', 'relatorios'],
];

function currentModule(file) {
  if (file.includes('/crm/')) return 'crm';
  if (file.includes('/atendimento/')) return 'atendimento';
  if (file.includes('/prospeccao/')) return 'prospeccao';
  if (file.includes('/marketing/')) return 'marketing';
  if (file.includes('/inteligencia/')) return 'inteligencia';
  if (file.includes('/relatorios/')) return 'relatorios';
  return 'visao';
}

for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  const before = html;

  const navStart = html.indexOf('<header class="top">');
  const navEnd = navStart >= 0 ? html.indexOf('</header>', navStart) : -1;
  if (navStart < 0 || navEnd < 0) continue;

  let header = html.slice(navStart, navEnd + '</header>'.length);
  const module = currentModule(file);
  const isCrm = module === 'crm';
  const cls = isCrm ? 'navlink' : '';

  for (const [href, label, key] of links) {
    if (header.includes(`href="${href}"`)) continue;
    const className = [cls, module === key ? 'active' : ''].filter(Boolean).join(' ');
    const anchor = `<a${className ? ` class="${className}"` : ''} href="${href}">${label}</a>`;

    const crmLogoutPos = header.indexOf('<a class="navlink" href="/painel/logout/"');
    const logoutPos = header.indexOf('<a href="/painel/logout/"');
    const pos = crmLogoutPos >= 0 ? crmLogoutPos : logoutPos;
    if (pos >= 0) header = header.slice(0, pos) + anchor + header.slice(pos);
  }

  html = html.slice(0, navStart) + header + html.slice(navEnd + '</header>'.length);
  if (html !== before) {
    await fs.writeFile(file, html);
    console.log(`Panel navigation normalized: ${file}`);
  }
}
