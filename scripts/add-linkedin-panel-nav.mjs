import fs from 'node:fs/promises';

const linkedinPath = '/painel/prospeccao/linkedin/';
const sourcePath = 'deploy/painel/prospeccao/index.html';
const targetPath = 'deploy/painel/prospeccao/linkedin/index.html';
const panelFiles = [
  'deploy/painel/index.html','deploy/painel/crm/index.html','deploy/painel/crm/autonomia/index.html','deploy/painel/crm/propostas/index.html',
  'deploy/painel/atendimento/index.html','deploy/painel/agenda/index.html','deploy/painel/prospeccao/index.html','deploy/painel/marketing/index.html',
  'deploy/painel/inteligencia/index.html','deploy/painel/growth/index.html','deploy/painel/relatorios/index.html','deploy/painel/relatorios/saude/index.html',
  'deploy/painel/usuarios/index.html','deploy/painel/conta/index.html',targetPath,
];

const linkedinLink = '<a class="cs-side-link" href="/painel/prospeccao/linkedin/" data-cs-key="linkedin" data-cs-permission="prospecting"><span class="cs-side-icon">in</span><span>LinkedIn</span><span class="cs-action-badge" data-cs-action="linkedin"></span></a>';

function addLink(html) {
  if (html.includes(`href="${linkedinPath}"`) && html.includes('class="cs-sidebar"')) return html;
  const marker = /(<a class="cs-side-link[^>]*href="\/painel\/prospeccao\/"[\s\S]*?<\/a>)/;
  if (marker.test(html)) return html.replace(marker, `$1${linkedinLink}`);
  return html;
}

function extract(html, re, label) {
  const match = html.match(re);
  if (!match) throw new Error(`Panel shell contract missing: ${label}`);
  return match[0];
}

let source = await fs.readFile(sourcePath, 'utf8');
source = addLink(source);
await fs.writeFile(sourcePath, source);

let target = await fs.readFile(targetPath, 'utf8');
if (!target.includes('class="cs-sidebar"')) {
  const style = extract(source, /<style data-cs-panel-shell>[\s\S]*?<\/style>/, 'style');
  let sidebar = extract(source, /<aside class="cs-sidebar"[\s\S]*?<\/aside>/, 'sidebar');
  const mobile = extract(source, /<button[^>]*id="csMobileMenu"[\s\S]*?<\/button>/, 'mobile menu');
  const notifications = extract(source, /<div[^>]*id="csNotifications"[\s\S]*?<\/div>\s*<\/div>/, 'notifications');
  const toast = extract(source, /<div[^>]*id="csLeadToast"[\s\S]*?<\/div>/, 'lead toast');
  const shellScript = extract(source, /<script data-cs-panel-shell>[\s\S]*?<\/script>/, 'shell script');
  sidebar = addLink(sidebar).replace(/class="cs-side-link active"/g, 'class="cs-side-link"');
  sidebar = sidebar.replace(/class="cs-side-link" href="\/painel\/prospeccao\/linkedin\/"/, 'class="cs-side-link active" href="/painel/prospeccao/linkedin/"');
  target = target.replace('</head>', `${style}</head>`).replace(/<body[^>]*>/, (m) => `${m}${mobile}${sidebar}${notifications}${toast}`).replace('</body>', `${shellScript}</body>`);
}
target = addLink(target);
await fs.writeFile(targetPath, target);

for (const file of panelFiles) {
  if (file === targetPath) continue;
  let html;
  try { html = await fs.readFile(file, 'utf8'); } catch { continue; }
  const updated = addLink(html);
  if (updated !== html) await fs.writeFile(file, updated);
}

console.log('LinkedIn workspace navigation integrated across Code Solution panel.');
