import fs from 'node:fs/promises';

const files = [
  'deploy/painel/index.html',
  'deploy/painel/crm/index.html',
  'deploy/painel/crm/autonomia/index.html',
  'deploy/painel/marketing/index.html',
  'deploy/painel/inteligencia/index.html',
  'deploy/painel/growth/index.html',
  'deploy/painel/atendimento/index.html',
  'deploy/painel/agenda/index.html',
  'deploy/painel/prospeccao/index.html',
  'deploy/painel/relatorios/index.html',
  'deploy/painel/relatorios/saude/index.html',
  'deploy/painel/usuarios/index.html',
  'deploy/painel/conta/index.html',
];

const links = [
  ['/painel/', 'Visão', 'visao'],
  ['/painel/crm/', 'CRM', 'crm'],
  ['/painel/crm/autonomia/', 'Autonomia', 'autonomia'],
  ['/painel/atendimento/', 'Atendimento', 'atendimento'],
  ['/painel/agenda/', 'Agenda', 'agenda'],
  ['/painel/prospeccao/', 'Prospecção', 'prospeccao'],
  ['/painel/marketing/', 'Marketing', 'marketing'],
  ['/painel/inteligencia/', 'Inteligência', 'inteligencia'],
  ['/painel/growth/', 'Growth', 'growth'],
  ['/painel/relatorios/', 'Relatórios', 'relatorios'],
  ['/painel/relatorios/saude/', 'Saúde', 'saude'],
  ['/painel/usuarios/', 'Usuários', 'usuarios'],
  ['/painel/conta/', 'Minha conta', 'conta'],
];

function currentModule(file) {
  if (file.endsWith('/painel/index.html')) return 'visao';
  if (file.includes('/crm/autonomia/')) return 'autonomia';
  if (file.includes('/crm/')) return 'crm';
  if (file.includes('/atendimento/')) return 'atendimento';
  if (file.includes('/agenda/')) return 'agenda';
  if (file.includes('/prospeccao/')) return 'prospeccao';
  if (file.includes('/marketing/')) return 'marketing';
  if (file.includes('/inteligencia/')) return 'inteligencia';
  if (file.includes('/growth/')) return 'growth';
  if (file.includes('/relatorios/saude/')) return 'saude';
  if (file.includes('/relatorios/')) return 'relatorios';
  if (file.includes('/usuarios/')) return 'usuarios';
  if (file.includes('/conta/')) return 'conta';
  return 'visao';
}

function normalHeader(module) {
  const anchors = links.map(([href, label, key]) => {
    const active = module === key ? ' class="active"' : '';
    return `<a${active} href="${href}">${label}</a>`;
  }).join('');
  return `<header class="top"><nav class="nav"><div class="brand">CODE <b>SOLUTION</b> · PAINEL</div>${anchors}<a href="/painel/logout/">Sair</a></nav></header>`;
}

function crmHeader() {
  const anchors = links.map(([href, label, key]) => {
    const active = key === 'crm' ? ' active' : '';
    return `<a class="navlink${active}" href="${href}">${label}</a>`;
  }).join('');
  return `<header class="top"><div class="row"><div class="brand">CODE <b>SOLUTION</b> · CRM</div><div class="navmini">${anchors}<a class="navlink" href="/painel/logout/">Sair</a></div><button id="newLead" class="btn primary">+ Novo lead</button></div></header>`;
}

for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  const start = html.indexOf('<header class="top">');
  const end = start >= 0 ? html.indexOf('</header>', start) : -1;
  if (start < 0 || end < 0) throw new Error(`Panel header not found: ${file}`);

  const module = currentModule(file);
  const header = module === 'crm' ? crmHeader() : normalHeader(module);
  const next = html.slice(0, start) + header + html.slice(end + '</header>'.length);
  if (next !== html) {
    await fs.writeFile(file, next);
    console.log(`Panel navigation rebuilt: ${file}`);
  }
}
