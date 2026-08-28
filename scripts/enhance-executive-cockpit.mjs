import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'deploy/painel';
const page = path.join(root, 'executivo', 'index.html');
const link = '<a class="cs-side-link" href="/painel/executivo/" data-cs-section="executivo" data-cs-permission="crm_read"><span class="cs-side-icon">◈</span><span>Executivo</span><span class="cs-action-badge" data-cs-action="executivo"></span></a>';

const source = await fs.readFile(page, 'utf8');
for (const needle of ['Cockpit Executivo','/api/crm/leads?limit=500','/api/crm/autonomy','/api/crm/autonomy/artifacts','Próximas melhores ações','SLA de primeiro contato']) {
  if (!source.includes(needle)) throw new Error('Executive cockpit missing: ' + needle);
}

const files = await walk(root);
let changed = 0;
for (const file of files) {
  if (file === page) continue;
  let html = await fs.readFile(file, 'utf8');
  if (!html.includes('class="cs-side-nav"') || html.includes('href="/painel/executivo/"')) continue;
  html = html.replace('<nav class="cs-side-nav">', '<nav class="cs-side-nav">' + link);
  await fs.writeFile(file, html, 'utf8');
  changed++;
}
console.log('Executive cockpit validated; menu injected into ' + changed + ' panel surfaces.');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
