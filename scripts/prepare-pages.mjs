import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const deploy = path.join(root, 'deploy');

const homeFaq = [
  ['Quanto custa desenvolver um sistema sob medida?','Depende do escopo, das integrações e do nível de complexidade. A Code Solution faz um diagnóstico gratuito e envia uma proposta com valor e prazo fechados para o escopo acordado.'],
  ['Quanto tempo leva para ficar pronto?','Um MVP funcional costuma ficar pronto em 6 a 12 semanas. Projetos maiores são divididos em entregas para gerar valor antes do fim.'],
  ['O código e os dados ficam com a minha empresa?','Sim. O cliente é dono do código, da propriedade intelectual e dos dados, com arquitetura documentada para reduzir dependência do fornecedor.'],
  ['Vocês atendem empresas de fora de Penápolis e São Paulo?','Sim. A Code Solution atende empresas de todo o Brasil de forma remota, com base em Penápolis e São Paulo.'],
  ['Sistema sob medida substitui um ERP?','Nem sempre. O caminho comum é manter o ERP no que ele faz bem e desenvolver sob medida onde o processo da empresa é diferente, integrando os dois.'],
  ['E depois da entrega, tem suporte?','Sim. A Code Solution oferece sustentação contínua, monitoramento e evolução do produto conforme o negócio muda.'],
];

const sharedStyle = `<style data-cs-extension-style>:root{--cs-bg:#0a0810;--cs-card:#12101a;--cs-line:rgba(255,255,255,.09);--cs-text:#ece9f2;--cs-muted:#a7a4b6;--cs-purple:#9b5cff;--cs-lilac:#c9b0ff}.cs-extension{position:relative;z-index:3;background:var(--cs-bg);color:var(--cs-text);font:15px/1.62 system-ui,-apple-system,Segoe UI,sans-serif;padding:72px max(20px,calc((100% - 1120px)/2))}.cs-extension *{box-sizing:border-box}.cs-extension h2,.cs-extension h3{line-height:1.12;margin-top:0}.cs-extension h2{font-size:clamp(30px,4vw,48px);max-width:24ch}.cs-kicker{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--cs-purple)}.cs-intro{color:var(--cs-muted);font-size:18px;max-width:760px}.cs-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:24px}.cs-card{border:1px solid var(--cs-line);border-radius:16px;background:var(--cs-card);padding:22px}.cs-card h3{font-size:17px;margin-bottom:8px}.cs-card p{color:var(--cs-muted);margin:0}.cs-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.cs-btn{display:inline-block;padding:12px 16px;border-radius:11px;text-decoration:none;font-weight:800;background:linear-gradient(135deg,#7B3FE4,#9b5cff);color:white}.cs-btn.alt{background:#171321;border:1px solid var(--cs-line)}.cs-faq{margin-top:54px}.cs-faq-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cs-table{margin-top:24px;border:1px solid var(--cs-line);border-radius:14px;overflow:hidden}.cs-row{display:grid;grid-template-columns:1fr 1fr 1fr}.cs-row>*{padding:14px;border-right:1px solid var(--cs-line);border-bottom:1px solid var(--cs-line)}.cs-row>*:last-child{border-right:0}.cs-head{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--cs-lilac);background:rgba(155,92,255,.08)}@media(max-width:760px){.cs-grid,.cs-faq-grid,.cs-row{grid-template-columns:1fr}.cs-head{display:none}.cs-row>*{border-right:0}}</style>`;

const homeVisible = `${sharedStyle}<section class="cs-extension" id="cs-commercial-extension"><span class="cs-kicker">Próximo passo</span><h2>Entenda o cenário antes de decidir a tecnologia.</h2><p class="cs-intro">Você pode explorar soluções por setor, estimar uma faixa de investimento, medir a maturidade digital ou conversar com o Codi. Tudo parte do problema real da operação.</p><div class="cs-grid"><article class="cs-card"><h3>Soluções por setor</h3><p>Agro, logística e varejo com problemas, soluções e resultados esperados.</p><div class="cs-actions"><a class="cs-btn" href="/setores/">Ver setores</a></div></article><article class="cs-card"><h3>Calculadora de projeto</h3><p>Faixa preliminar de investimento e prazo para software, app, SaaS, automação e BI.</p><div class="cs-actions"><a class="cs-btn" href="/calculadora/">Estimar projeto</a></div></article><article class="cs-card"><h3>Diagnóstico Digital</h3><p>Score 0–100 para identificar maturidade, gargalos e prioridades.</p><div class="cs-actions"><a class="cs-btn" href="/diagnostico/">Fazer diagnóstico</a></div></article><article class="cs-card"><h3>Codi</h3><p>Assistente digital para entender sua necessidade e encaminhar o próximo passo.</p><div class="cs-actions"><a class="cs-btn" href="/assistente/">Conversar com o Codi</a></div></article></div><div class="cs-faq" id="faq"><span class="cs-kicker">Dúvidas frequentes</span><h2>O que as empresas perguntam antes de contratar</h2><div class="cs-faq-grid">${homeFaq.map(([q,a])=>`<article class="cs-card"><h3>${q}</h3><p>${a}</p></article>`).join('')}</div></div></section>`;

const servicesVisible = `${sharedStyle}<section class="cs-extension" id="cs-services-aeo"><span class="cs-kicker">Resposta direta</span><h2>Software, automação, IA e dados sob medida para o processo da sua empresa.</h2><p class="cs-intro" data-aeo-answer>A Code Solution desenvolve sistemas e plataformas quando o processo da empresa não cabe em uma solução genérica, automatiza tarefas repetitivas e integra sistemas existentes, cria agentes de IA conectados ao contexto do negócio e estrutura dados e BI para apoiar decisões. O projeto começa pelo processo, pelas integrações e pelo resultado que precisa ser medido.</p><div class="cs-grid"><article class="cs-card"><h3>Desenvolvimento de software</h3><p>Sistemas, portais, plataformas, APIs e aplicações construídas conforme o processo real.</p></article><article class="cs-card"><h3>Automação e integrações</h3><p>Redução de retrabalho, conexão entre sistemas e automação de rotinas operacionais.</p></article><article class="cs-card"><h3>Inteligência artificial</h3><p>Agentes, copilotos e atendimento digital integrados aos dados e regras da empresa.</p></article><article class="cs-card"><h3>Dados e BI</h3><p>Bancos de dados, indicadores, dashboards e camadas de informação para decisão.</p></article></div><div class="cs-table"><div class="cs-row"><div class="cs-head">Problema</div><div class="cs-head">Solução</div><div class="cs-head">Resultado esperado</div></div><div class="cs-row"><div>Planilhas e retrabalho entre áreas</div><div>Automação e integração de sistemas</div><div>Menos operação manual e mais rastreabilidade</div></div><div class="cs-row"><div>Processo específico que o ERP não cobre</div><div>Sistema sob medida integrado ao ERP</div><div>Processo digital sem trocar o que já funciona</div></div><div class="cs-row"><div>Dados espalhados e decisão tardia</div><div>Base estruturada, BI e alertas</div><div>Indicadores confiáveis e ação mais rápida</div></div></div><div class="cs-actions"><a class="cs-btn" href="/setores/">Ver por setor</a><a class="cs-btn alt" href="/calculadora/">Calcular faixa</a><a class="cs-btn alt" href="/diagnostico/">Diagnóstico Digital</a><a class="cs-btn alt" href="/assistente/">Conversar com o Codi</a></div></section>`;

const pages = [
  {
    file: 'index.html',
    canonical: 'https://www.codesolution.com.br/',
    title: 'Code Solution — Desenvolvimento de software, automação, IA e dados',
    description: 'Software house brasileira para desenvolvimento de software sob medida, automação de processos, inteligência artificial, integrações, dados e BI.',
    body: `<main><h1>Engenharia de software para empresas</h1><p>A Code Solution desenvolve software sob medida, automação de processos, inteligência artificial, integrações, bancos de dados e soluções de BI para empresas.</p><h2>O que fazemos</h2><ul><li>Desenvolvimento de sistemas e plataformas</li><li>Automação de processos e integrações</li><li>Agentes e soluções com inteligência artificial</li><li>Arquitetura de dados, bancos de dados e BI</li></ul><h2>Como começar</h2><p>Conte o cenário da sua empresa e a equipe da Code Solution avalia o problema, a viabilidade técnica e o próximo passo recomendado.</p><p><a href="/setores/">Soluções por setor</a> · <a href="/calculadora/">Estime seu projeto</a> · <a href="/diagnostico/">Faça o Diagnóstico Digital</a> · <a href="/assistente/">Converse com o Codi</a> · <a href="/servicos/">Conheça os serviços</a> · <a href="/blog/artigos/">Leia o blog técnico</a></p></main>`,
    visible: homeVisible,
    schema: [
      { '@context':'https://schema.org','@type':'Organization', name:'Code Solution', url:'https://www.codesolution.com.br/', foundingDate:'2018', telephone:'+5518996809954', description:'Desenvolvimento de software sob medida, automação de processos, inteligência artificial, integrações e dados para empresas.' },
      { '@context':'https://schema.org','@type':'WebSite', name:'Code Solution', url:'https://www.codesolution.com.br/', inLanguage:['pt-BR','en','es'] },
      { '@context':'https://schema.org','@type':'FAQPage', mainEntity: homeFaq.map(([q,a])=>({ '@type':'Question', name:q, acceptedAnswer:{ '@type':'Answer', text:a } })) },
    ],
  },
  {
    file: 'servicos/index.html',
    canonical: 'https://www.codesolution.com.br/servicos/',
    title: 'Serviços de tecnologia | Code Solution',
    description: 'Desenvolvimento sob medida, automação, inteligência artificial, integrações, dados e BI para empresas.',
    body: `<main><h1>Serviços de tecnologia para empresas</h1><p>A Code Solution transforma problemas operacionais e oportunidades de negócio em soluções digitais sustentáveis.</p><h2>Desenvolvimento de software</h2><p>Sistemas, portais, plataformas, APIs e aplicações construídas conforme o processo e a necessidade do negócio.</p><h2>Automação e integrações</h2><p>Automação de tarefas repetitivas, integração entre sistemas e redução de retrabalho operacional.</p><h2>Inteligência artificial</h2><p>Agentes de IA, atendimento digital, copilotos internos e automações inteligentes com governança e integração aos processos existentes.</p><h2>Dados e BI</h2><p>Estruturação de dados, bancos de dados, indicadores, dashboards e camadas de informação para apoiar decisões.</p><p><a href="/setores/">Ver soluções por setor</a> · <a href="/calculadora/">Calcular faixa de investimento</a> · <a href="/diagnostico/">Avaliar maturidade digital</a> · <a href="/assistente/">Conversar com o Codi</a> · <a href="https://wa.me/5518996809954">Solicitar uma conversa técnica</a></p></main>`,
    visible: servicesVisible,
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
console.log('Pages prepared: SEO/AEO fallbacks, visible commercial extensions, acquisition routes and security headers applied.');

async function enhancePage({ file, canonical, title, description, body, schema, visible = '' }) {
  const target = path.join(deploy, file);
  let html = await fs.readFile(target, 'utf8');
  html = html.replace(/\n?\s*<!-- SEO-FALLBACK:START -->[\s\S]*?<!-- SEO-FALLBACK:END -->\s*/g, '\n');
  html = html.replace(/\n?\s*<!-- SEO-SCHEMA:START -->[\s\S]*?<!-- SEO-SCHEMA:END -->\s*/g, '\n');
  html = html.replace(/\n?\s*<!-- COMMERCIAL-EXTENSION:START -->[\s\S]*?<!-- COMMERCIAL-EXTENSION:END -->\s*/g, '\n');
  const headBlock = `\n  <!-- SEO-SCHEMA:START -->\n  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">\n  <link rel="canonical" href="${canonical}">\n  ${schema.map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g,'\\u003c')}</script>`).join('\n  ')}\n  <!-- SEO-SCHEMA:END -->\n`;
  html = html.replace('</head>', `${headBlock}</head>`);
  const fallback = `\n  <!-- SEO-FALLBACK:START -->\n  <noscript><section style="max-width:900px;margin:40px auto;padding:24px;color:#eee;background:#0a0810;font:16px/1.7 system-ui,sans-serif"><h2 style="font-size:0;line-height:0;margin:0">${escapeHtml(title)}</h2>${body}</section></noscript>\n  <!-- SEO-FALLBACK:END -->\n`;
  const visibleBlock = visible ? `\n  <!-- COMMERCIAL-EXTENSION:START -->\n  ${visible}\n  <!-- COMMERCIAL-EXTENSION:END -->\n` : '';
  html = html.replace('</body>', `${fallback}${visibleBlock}</body>`);
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
