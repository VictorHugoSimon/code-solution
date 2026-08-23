import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const deploy = path.join(root, 'deploy');

const pages = [
  {
    file: 'index.html',
    canonical: 'https://www.codesolution.com.br/',
    title: 'Code Solution — Desenvolvimento de software, automação, IA e dados',
    description: 'Software house brasileira para desenvolvimento de software sob medida, automação de processos, inteligência artificial, integrações, dados e BI.',
    body: `<main><h1>Engenharia de software para empresas</h1><p>A Code Solution desenvolve software sob medida, automação de processos, inteligência artificial, integrações, bancos de dados e soluções de BI para empresas.</p><h2>O que fazemos</h2><ul><li>Desenvolvimento de sistemas e plataformas</li><li>Automação de processos e integrações</li><li>Agentes e soluções com inteligência artificial</li><li>Arquitetura de dados, bancos de dados e BI</li></ul><h2>Como começar</h2><p>Conte o cenário da sua empresa e a equipe da Code Solution avalia o problema, a viabilidade técnica e o próximo passo recomendado.</p><p><a href="/setores/">Soluções por setor</a> · <a href="/calculadora/">Estime seu projeto</a> · <a href="/diagnostico/">Faça o Diagnóstico Digital</a> · <a href="/assistente/">Converse com o Codi</a> · <a href="/servicos/">Conheça os serviços</a> · <a href="/blog/artigos/">Leia o blog técnico</a></p></main>`,
    schema: [
      { '@context':'https://schema.org','@type':'Organization', name:'Code Solution', url:'https://www.codesolution.com.br/', foundingDate:'2018', telephone:'+5518996809954', description:'Desenvolvimento de software sob medida, automação de processos, inteligência artificial, integrações e dados para empresas.' },
      { '@context':'https://schema.org','@type':'WebSite', name:'Code Solution', url:'https://www.codesolution.com.br/', inLanguage:['pt-BR','en','es'] },
    ],
  },
  {
    file: 'servicos/index.html',
    canonical: 'https://www.codesolution.com.br/servicos/',
    title: 'Serviços de tecnologia | Code Solution',
    description: 'Desenvolvimento sob medida, automação, inteligência artificial, integrações, dados e BI para empresas.',
    body: `<main><h1>Serviços de tecnologia para empresas</h1><p>A Code Solution transforma problemas operacionais e oportunidades de negócio em soluções digitais sustentáveis.</p><h2>Desenvolvimento de software</h2><p>Sistemas, portais, plataformas, APIs e aplicações construídas conforme o processo e a necessidade do negócio.</p><h2>Automação e integrações</h2><p>Automação de tarefas repetitivas, integração entre sistemas e redução de retrabalho operacional.</p><h2>Inteligência artificial</h2><p>Agentes de IA, atendimento digital, copilotos internos e automações inteligentes com governança e integração aos processos existentes.</p><h2>Dados e BI</h2><p>Estruturação de dados, bancos de dados, indicadores, dashboards e camadas de informação para apoiar decisões.</p><p><a href="/setores/">Ver soluções por setor</a> · <a href="/calculadora/">Calcular faixa de investimento</a> · <a href="/diagnostico/">Avaliar maturidade digital</a> · <a href="/assistente/">Conversar com o Codi</a> · <a href="https://wa.me/5518996809954">Solicitar uma conversa técnica</a></p></main>`,
    schema: [{ '@context':'https://schema.org','@type':'Service', provider:{'@type':'Organization',name:'Code Solution',url:'https://www.codesolution.com.br/'}, serviceType:'Desenvolvimento de software, automação, inteligência artificial, integrações e dados', areaServed:'BR' }],
  },
  {
    file: 'blog/index.html',
    canonical: 'https://www.codesolution.com.br/blog/',
    title: 'Blog técnico | Code Solution',
    description: 'Conteúdo sobre software, automação, inteligência artificial, dados, integrações e segurança para empresas.',
    body: `<main><h1>Conteúdo técnico para empresas</h1><p>Artigos da Code Solution sobre desenvolvimento de software, automação, inteligência artificial, dados, integrações, segurança e modernização tecnológica.</p><p><a href="/blog/artigos/">Ver artigos indexáveis</a> · <a href="/setores/">Soluções por setor</a> · <a href="/calculadora/">Estimar um projeto</a> · <a href="/diagnostico/">Fazer Diagnóstico Digital</a> · <a href="/assistente/">Conversar com o Codi</a></p></main>`,
    schema: [{ '@context':'https://schema.org','@type':'Blog', name:'Blog Code Solution', url:'https://www.codesolution.com.br/blog/', publisher:{'@type':'Organization',name:'Code Solution',url:'https://www.codesolution.com.br/'} }],
  },
];

for (const page of pages) await enhancePage(page);
for (const file of ['painel/index.html','painel/marketing/index.html','painel/inteligencia/index.html','painel/crm/index.html']) await noindex(file);
await writeHeaders();
await ensureSitemapPages();
console.log('Pages prepared: SEO/AEO fallbacks, acquisition routes and security headers applied.');

async function enhancePage({ file, canonical, title, description, body, schema }) {
  const target = path.join(deploy, file);
  let html = await fs.readFile(target, 'utf8');
  html = html.replace(/\n?\s*<!-- SEO-FALLBACK:START -->[\s\S]*?<!-- SEO-FALLBACK:END -->\s*/g, '\n');
  html = html.replace(/\n?\s*<!-- SEO-SCHEMA:START -->[\s\S]*?<!-- SEO-SCHEMA:END -->\s*/g, '\n');
  const headBlock = `\n  <!-- SEO-SCHEMA:START -->\n  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">\n  <link rel="canonical" href="${canonical}">\n  ${schema.map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g,'\\u003c')}</script>`).join('\n  ')}\n  <!-- SEO-SCHEMA:END -->\n`;
  html = html.replace('</head>', `${headBlock}</head>`);
  const fallback = `\n  <!-- SEO-FALLBACK:START -->\n  <noscript><section style="max-width:900px;margin:40px auto;padding:24px;color:#eee;background:#0a0810;font:16px/1.7 system-ui,sans-serif"><h2 style="font-size:0;line-height:0;margin:0">${escapeHtml(title)}</h2>${body}</section></noscript>\n  <!-- SEO-FALLBACK:END -->\n`;
  html = html.replace('</body>', `${fallback}</body>`);
  if (!html.includes(`content="${description}`) && html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n  <meta name="description" content="${escapeAttr(description)}">`);
  }
  await fs.writeFile(target, html, 'utf8');
}

async function noindex(file) {
  const target = path.join(deploy, file);
  try {
    let html = await fs.readFile(target,'utf8');
    if (!/name=["']robots["']/i.test(html)) html = html.replace('</head>', '  <meta name="robots" content="noindex,nofollow,noarchive">\n</head>');
    await fs.writeFile(target, html, 'utf8');
  } catch {}
}

async function writeHeaders() {
  const headers = `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/painel/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n`;
  await fs.writeFile(path.join(deploy,'_headers'), headers, 'utf8');
}

async function ensureSitemapPages() {
  const target = path.join(deploy, 'sitemap.xml');
  let xml = await fs.readFile(target, 'utf8');
  xml = xml.replace(/\n?\s*<!-- STATIC-PAGES:START -->[\s\S]*?<!-- STATIC-PAGES:END -->\s*/g, '\n');
  const block = `\n  <!-- STATIC-PAGES:START -->\n  <url><loc>https://www.codesolution.com.br/diagnostico/</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n  <url><loc>https://www.codesolution.com.br/assistente/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n  <url><loc>https://www.codesolution.com.br/setores/</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n  <url><loc>https://www.codesolution.com.br/setores/#agro</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n  <url><loc>https://www.codesolution.com.br/setores/#logistica</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n  <url><loc>https://www.codesolution.com.br/setores/#varejo</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n  <url><loc>https://www.codesolution.com.br/calculadora/</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n  <url><loc>https://www.codesolution.com.br/privacidade/</loc><changefreq>yearly</changefreq><priority>0.4</priority></url>\n  <url><loc>https://www.codesolution.com.br/blog/artigos/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n  <!-- STATIC-PAGES:END -->\n`;
  xml = xml.replace(/<\/urlset>\s*$/i, `${block}</urlset>\n`);
  await fs.writeFile(target, xml, 'utf8');
}

function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(v) { return escapeHtml(v); }
