import fs from 'node:fs/promises';

const path = 'deploy/_worker.js';
let source = await fs.readFile(path, 'utf8');
const marker = '// PAGES-RELEASE-HEALTH:delivery-v2';
const route = `${marker}\n    if (url.pathname === '/__health/pages' && request.method === 'GET') {\n      return new Response(JSON.stringify({\n        ok: true,\n        service: 'code-solution-pages',\n        build: 'code-solution-pages-2026-09-01.delivery-v2',\n        branding: 'Code Solution',\n        deliveryUiVersion: 2,\n        deliveryUiPath: '/painel/delivery/',\n        crmLoginPath: '/painel/login/',\n        protectedPanels: true\n      }), { status: 200, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' } });\n    }`;

if (!source.includes(marker)) {
  const needle = "    const url = new URL(request.url);";
  if (!source.includes(needle)) throw new Error('Pages worker fetch entrypoint not found');
  source = source.replace(needle, `${needle}\n\n${route}`);
  await fs.writeFile(path, source);
}

const delivery = await fs.readFile('deploy/painel/delivery/index.html', 'utf8');
const deliveryUi = await fs.readFile('deploy/painel/delivery/v2.js', 'utf8');
if (!delivery.includes('data-cs-delivery-v2="1"')) throw new Error('Delivery v2 script tag was not injected');
for (const needle of ['Delivery v2', '/api/crm/autonomy/delivery', 'Incidentes/RCA']) {
  if (!deliveryUi.includes(needle)) throw new Error(`Delivery v2 UI contract missing: ${needle}`);
}
console.log('Pages release health marker + Delivery v2 UI contract ready.');
