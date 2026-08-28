import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'deploy/painel';
const page = path.join(root, 'delivery', 'index.html');
const link = '<a class="cs-side-link" href="/painel/delivery/" data-cs-section="delivery" data-cs-permission="crm_read"><span class="cs-side-icon">▦</span><span>Delivery</span><span class="cs-action-badge" data-cs-action="delivery"></span></a>';

const source = await fs.readFile(page, 'utf8');
for (const needle of ['Central de Delivery','/api/crm/autonomy/artifacts','Handoffs em rascunho','Checklist de kickoff','Delivery Agent']) {
  if (!source.includes(needle)) throw new Error('Delivery center missing: ' + needle);
}

const files = await walk(root);
let changed = 0;
for (const file of files) {
  if (file === page) continue;
  let html = await fs.readFile(file, 'utf8');
  if (!html.includes('class="cs-side-nav"') || html.includes('href="/painel/delivery/"')) continue;
  const executiveHref = 'href="/painel/executivo/"';
  const executivePos = html.indexOf(executiveHref);
  if (executivePos >= 0) {
    const end = html.indexOf('</a>', executivePos);
    if (end >= 0) html = html.slice(0, end + 4) + link + html.slice(end + 4);
    else html = html.replace('<nav class="cs-side-nav">', '<nav class="cs-side-nav">' + link);
  } else {
    html = html.replace('<nav class="cs-side-nav">', '<nav class="cs-side-nav">' + link);
  }
  await fs.writeFile(file, html, 'utf8');
  changed++;
}
console.log('Delivery center validated; menu injected into ' + changed + ' panel surfaces.');

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
