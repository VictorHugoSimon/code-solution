import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'deploy/painel';
const files = await collectHtml(root);
let changed = 0;

for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  const before = html;

  if (!html.includes('/painel/crm/governanca/')) {
    html = html.replace(
      /(<a[^>]+href=["']\/painel\/crm\/autonomia\/["'][^>]*>[^<]*<\/a>)/i,
      '$1<a href="/painel/crm/governanca/">Governança</a>',
    );
    html = html.replace(
      /(<a[^>]+class=["'][^"']*cs-side-link[^"']*["'][^>]+href=["']\/painel\/crm\/autonomia\/["'][^>]*>[\s\S]*?<\/a>)/i,
      '$1<a class="cs-side-link" href="/painel/crm/governanca/"><span class="cs-side-icon">⚙</span><span>Governança</span></a>',
    );
  }

  if (file.endsWith('/crm/autonomia/index.html')) {
    html = html
      .replace('Próximos agentes', 'Agentes avançados')
      .replace('Planejado · Onda 4', 'Ativo em shadow · Onda 4')
      .replace('Próxima onda · Onda 5', 'Ativo interno · Onda 5')
      .replace('Projeto ganho → backlog, riscos, status report e release notes.', 'Negócio ganho → handoff interno, escopo, riscos, checklist e preparação de kickoff.')
      .replace('Brief diário, anomalias, prioridades e meta x realizado.', 'Brief diário interno, anomalias, prioridades, pipeline, aprovações e saúde dos agentes.');
  }

  if (html !== before) {
    await fs.writeFile(file, html);
    changed++;
  }
}

console.log(`Autonomous governance navigation enhanced in ${changed} panel pages.`);

async function collectHtml(dir) {
  const out = [];
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collectHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
