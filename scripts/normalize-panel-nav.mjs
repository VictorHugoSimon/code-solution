import fs from 'node:fs/promises';

const files = [
  'deploy/painel/crm/index.html',
  'deploy/painel/marketing/index.html',
  'deploy/painel/inteligencia/index.html',
  'deploy/painel/atendimento/index.html',
  'deploy/painel/prospeccao/index.html',
];

const links = [
  ['/painel/', 'Visão'],
  ['/painel/crm/', 'CRM'],
  ['/painel/atendimento/', 'Atendimento'],
  ['/painel/prospeccao/', 'Prospecção'],
  ['/painel/marketing/', 'Marketing'],
  ['/painel/inteligencia/', 'Inteligência'],
];

for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  const before = html;

  const navStart = html.indexOf('<header class="top">');
  const navEnd = navStart >= 0 ? html.indexOf('</header>', navStart) : -1;
  if (navStart < 0 || navEnd < 0) continue;

  let header = html.slice(navStart, navEnd + '</header>'.length);
  const isCrm = file.includes('/crm/');
  const cls = isCrm ? 'navlink' : '';

  for (const [href, label] of links) {
    if (header.includes(`href="${href}"`)) continue;
    const active = file.includes(href.replace('/painel/', '').replaceAll('/', ''));
    const className = [cls, active ? 'active' : ''].filter(Boolean).join(' ');
    const anchor = `<a${className ? ` class="${className}"` : ''} href="${href}">${label}</a>`;

    const logoutPos = header.indexOf('<a href="/painel/logout/"');
    const crmLogoutPos = header.indexOf('<a class="navlink" href="/painel/logout/"');
    const pos = logoutPos >= 0 ? logoutPos : crmLogoutPos;
    if (pos >= 0) header = header.slice(0, pos) + anchor + header.slice(pos);
  }

  html = html.slice(0, navStart) + header + html.slice(navEnd + '</header>'.length);
  if (html !== before) {
    await fs.writeFile(file, html);
    console.log(`Panel navigation normalized: ${file}`);
  }
}
