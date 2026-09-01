import fs from 'node:fs/promises';

const path = 'deploy/painel/delivery/index.html';
let html = await fs.readFile(path, 'utf8');
const tag = '<script src="/painel/delivery/v2.js" data-cs-delivery-v2="1"></script>';
if (!html.includes('data-cs-delivery-v2="1"')) {
  html = html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : `${html}${tag}`;
}
if (!html.includes('Central de Delivery')) throw new Error('Delivery panel base contract missing');
await fs.writeFile(path, html);

const ui = await fs.readFile('deploy/painel/delivery/v2.js', 'utf8');
for (const needle of ['/api/crm/autonomy/delivery', 'Delivery v2', 'Gerar status', 'Release notes', 'Incidentes/RCA']) {
  if (!ui.includes(needle)) throw new Error(`Delivery v2 UI contract missing: ${needle}`);
}
console.log('Delivery v2 UI wired into production panel.');
