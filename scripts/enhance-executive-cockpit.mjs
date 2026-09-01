import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'deploy/painel';
const page = path.join(root, 'executivo', 'index.html');
const goalsScriptPath = path.join(root, 'executivo', 'goals.js');
const link = '<a class="cs-side-link" href="/painel/executivo/" data-cs-section="executivo" data-cs-permission="crm_read"><span class="cs-side-icon">◈</span><span>Executivo</span><span class="cs-action-badge" data-cs-action="executivo"></span></a>';
const goalsScriptTag = '<script src="/painel/executivo/goals.js" defer></script>';

let source = await fs.readFile(page, 'utf8');
for (const needle of ['Cockpit Executivo',"API+'/leads?limit=500'", "API+'/autonomy'", "API+'/autonomy/artifacts'",'Próximas melhores ações','SLA de primeiro contato']) {
  if (!source.includes(needle)) throw new Error('Executive cockpit missing: ' + needle);
}

const goalsSource = await fs.readFile(goalsScriptPath, 'utf8');
for (const needle of ['/api/crm','/acquisition/goals?days=7','Meta x Realizado · Aquisição','Próxima melhor ação de aquisição']) {
  if (!goalsSource.includes(needle)) throw new Error('Executive acquisition goals missing: ' + needle);
}

if (!source.includes('/painel/executivo/goals.js')) {
  if (!source.includes('</body>')) throw new Error('Executive cockpit body closing tag missing');
  source = source.replace('</body>', `${goalsScriptTag}</body>`);
  await fs.writeFile(page, source, 'utf8');
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
console.log('Executive cockpit validated with acquisition goal vs actual; menu injected into ' + changed + ' panel surfaces.');

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
