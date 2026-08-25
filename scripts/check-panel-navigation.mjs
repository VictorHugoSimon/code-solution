import fs from 'node:fs/promises';

const panels = [
  'deploy/painel/index.html','deploy/painel/crm/index.html','deploy/painel/atendimento/index.html','deploy/painel/agenda/index.html',
  'deploy/painel/prospeccao/index.html','deploy/painel/marketing/index.html','deploy/painel/inteligencia/index.html','deploy/painel/growth/index.html',
  'deploy/painel/relatorios/index.html','deploy/painel/usuarios/index.html','deploy/painel/conta/index.html',
];

const hrefs = ['/painel/','/painel/crm/','/painel/atendimento/','/painel/agenda/','/painel/prospeccao/','/painel/marketing/','/painel/inteligencia/','/painel/growth/','/painel/relatorios/','/painel/usuarios/','/painel/conta/','/painel/logout/'];
const failures = [];

for (const file of panels) {
  const html = await fs.readFile(file, 'utf8');
  const start = html.indexOf('<header class="top">');
  const end = start >= 0 ? html.indexOf('</header>', start) : -1;
  if (start < 0 || end < 0) { failures.push(`${file}: header missing`); continue; }
  const header = html.slice(start, end + '</header>'.length);
  for (const href of hrefs) {
    const count = header.split(`href="${href}"`).length - 1;
    if (count !== 1) failures.push(`${file}: expected one ${href} link in header, found ${count}`);
  }
  if (header.includes('${encodeURIComponent(l.id)}')) failures.push(`${file}: lead interpolation leaked into header`);
  if (header.includes('>Atender</a>') && !file.includes('/atendimento/')) failures.push(`${file}: unexpected lead action in global navigation`);
}

const prospecting = await fs.readFile('deploy/painel/prospeccao/index.html', 'utf8');
const scriptPos = prospecting.indexOf('<script>');
const script = scriptPos >= 0 ? prospecting.slice(scriptPos) : '';
if (!script.includes('/painel/atendimento/?lead=${encodeURIComponent(l.id)}')) failures.push('prospecting: lead-row Atendimento deep link missing');
const attendance = await fs.readFile('deploy/painel/atendimento/index.html', 'utf8');
if (!attendance.includes('CS-PANEL-DEEPLINK')) failures.push('attendance: requested lead deep-link handler missing');
const users = await fs.readFile('deploy/painel/usuarios/index.html','utf8');
for(const contract of ['/api/auth','Resetar senha','Revogar sessões','Auditoria recente']) if(!users.includes(contract)) failures.push(`users: missing ${contract}`);
const account = await fs.readFile('deploy/painel/conta/index.html','utf8');
for(const contract of ['/api/auth','Minha Conta','Trocar minha senha','activeSessions','failedLogins']) if(!account.includes(contract)) failures.push(`account: missing ${contract}`);

if (failures.length) { console.error('Panel navigation validation failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log('Panel navigation OK: all modules including My Account, Users, role governance UI, and lead deep-links validated.');
