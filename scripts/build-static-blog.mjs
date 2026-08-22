import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'content', 'blog', 'index.json');
const deployDir = path.join(root, 'deploy');
const posts = JSON.parse(await fs.readFile(indexPath, 'utf8'));
if (!Array.isArray(posts)) throw new Error('content/blog/index.json must be an array');

const locales = {
  pt: { lang: 'pt-BR', prefix: '', home: '/', blog: '/blog/', label: 'Voltar ao blog', cta: 'Fale com a Code Solution', contact: 'Vamos entender seu cenário e indicar o próximo passo técnico.' },
  en: { lang: 'en', prefix: '/en', home: '/en/', blog: '/en/blog/', label: 'Back to blog', cta: 'Talk to Code Solution', contact: 'Let’s understand your scenario and define the next technical step.' },
  es: { lang: 'es', prefix: '/es', home: '/es/', blog: '/es/blog/', label: 'Volver al blog', cta: 'Hable con Code Solution', contact: 'Entendamos su escenario y definamos el siguiente paso técnico.' },
};

const generated = [];
for (const post of posts) {
  if (!post?.slug) continue;
  for (const [code, locale] of Object.entries(locales)) {
    const p = post[code] || post.pt || post;
    const title = cleanText(p.title || post.title || post.slug);
    const excerpt = cleanText(p.excerpt || post.excerpt || '');
    const description = cleanText(p.metaDescription || excerpt).slice(0, 220);
    const body = sanitizeHtml(String(p.bodyHtml || p.body || post.bodyHtml || ''));
    if (!title || body.length < 50) continue;
    const urlPath = `${locale.prefix}/blog/${post.slug}/`.replace(/\/+/g, '/');
    const canonical = `https://www.codesolution.com.br${urlPath}`;
    const date = toIso(post.date);
    const outDir = path.join(deployDir, locale.prefix.replace(/^\//, ''), 'blog', post.slug);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'index.html'), renderPage({ code, locale, post, p, title, excerpt, description, body, canonical, date }), 'utf8');
    generated.push({ code, slug: post.slug, url: canonical, date });
  }
}

await writeIndexes(posts);
await updateSitemap(generated);
await fs.writeFile(path.join(deployDir, 'blog', 'static-index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), pages: generated }, null, 2) + '\n');
console.log(`Static blog: ${generated.length} page(s) generated from ${posts.length} post(s).`);

function renderPage({ code, locale, post, p, title, excerpt, description, body, canonical, date }) {
  const langs = Object.entries(locales).map(([c,l]) => {
    const href = `https://www.codesolution.com.br${l.prefix}/blog/${post.slug}/`.replace('com.br//','com.br/');
    return `<link rel="alternate" hreflang="${escapeAttr(l.lang)}" href="${escapeAttr(href)}">`;
  }).join('\n  ');
  const tags = Array.isArray(p.keywords) ? p.keywords.filter(Boolean).slice(0, 10) : [];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: date || undefined,
    dateModified: date || undefined,
    inLanguage: locale.lang,
    mainEntityOfPage: canonical,
    author: { '@type': 'Organization', name: 'Code Solution', url: 'https://www.codesolution.com.br/' },
    publisher: { '@type': 'Organization', name: 'Code Solution', url: 'https://www.codesolution.com.br/' },
    keywords: tags.join(', ') || undefined,
  };
  for (const k of Object.keys(schema)) if (schema[k] === undefined) delete schema[k];
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Code Solution', item: `https://www.codesolution.com.br${locale.prefix || '/'}` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `https://www.codesolution.com.br${locale.blog}` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical },
    ]
  };
  return `<!doctype html>
<html lang="${escapeAttr(locale.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} | Code Solution</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <link rel="canonical" href="${escapeAttr(canonical)}">
  ${langs}
  <link rel="alternate" hreflang="x-default" href="https://www.codesolution.com.br/blog/${escapeAttr(post.slug)}/">
  <meta property="og:type" content="article"><meta property="og:site_name" content="Code Solution"><meta property="og:title" content="${escapeAttr(title)}"><meta property="og:description" content="${escapeAttr(description)}"><meta property="og:url" content="${escapeAttr(canonical)}"><meta property="og:image" content="https://www.codesolution.com.br/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${safeJson(schema)}</script>
  <script type="application/ld+json">${safeJson(breadcrumb)}</script>
  <style>${styles()}</style>
</head>
<body>
<header class="top"><a href="${locale.home}" class="brand">CODE<span>SOLUTION</span></a><a href="${locale.blog}" class="back">${escapeHtml(locale.label)}</a></header>
<main>
<article>
  <div class="eyebrow">${escapeHtml(p.category || post.category || 'Code Solution')}</div>
  <h1>${escapeHtml(title)}</h1>
  ${excerpt ? `<p class="dek">${escapeHtml(excerpt)}</p>` : ''}
  <div class="meta">${date ? `<time datetime="${escapeAttr(date)}">${escapeHtml(formatDate(date, code))}</time>` : ''}${p.readingTime ? ` · ${escapeHtml(p.readingTime)}` : ''}</div>
  <div class="content">${body}</div>
  <aside class="cta"><strong>${escapeHtml(locale.cta)}</strong><p>${escapeHtml(locale.contact)}</p><a href="https://wa.me/5518996809954?text=${encodeURIComponent('Olá, vim pelo blog da Code Solution e quero conversar sobre uma solução para minha empresa.')}" rel="nofollow">WhatsApp</a></aside>
</article>
</main>
<footer>© ${new Date().getUTCFullYear()} Code Solution · Desenvolvimento de software, automação, IA e dados.</footer>
</body></html>`;
}

async function writeIndexes(posts) {
  for (const [code, locale] of Object.entries(locales)) {
    const items = posts.map(post => {
      const p = post[code] || post.pt || post;
      if (!post.slug || !p?.title) return '';
      const href = `${locale.prefix}/blog/${post.slug}/`.replace(/\/+/g,'/');
      return `<li><a href="${href}"><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.excerpt || '')}</span></a></li>`;
    }).filter(Boolean).join('\n');
    const outDir = path.join(deployDir, locale.prefix.replace(/^\//,''), 'blog', 'artigos');
    await fs.mkdir(outDir,{recursive:true});
    const title = code === 'pt' ? 'Artigos Code Solution' : code === 'en' ? 'Code Solution Articles' : 'Artículos Code Solution';
    const intro = code === 'pt' ? 'Conteúdo técnico sobre software, automação, inteligência artificial, dados e segurança para empresas.' : code === 'en' ? 'Technical content about software, automation, artificial intelligence, data and security for businesses.' : 'Contenido técnico sobre software, automatización, inteligencia artificial, datos y seguridad para empresas.';
    await fs.writeFile(path.join(outDir,'index.html'), `<!doctype html><html lang="${locale.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${escapeAttr(intro)}"><link rel="canonical" href="https://www.codesolution.com.br${locale.prefix}/blog/artigos/"><style>${styles()}</style></head><body><header class="top"><a href="${locale.home}" class="brand">CODE<span>SOLUTION</span></a></header><main><article><h1>${title}</h1><p class="dek">${intro}</p><ul class="article-list">${items}</ul></article></main></body></html>`, 'utf8');
  }
}

async function updateSitemap(generated) {
  const sitemapPath = path.join(deployDir, 'sitemap.xml');
  let xml = '';
  try { xml = await fs.readFile(sitemapPath,'utf8'); } catch {}
  if (!xml.includes('<urlset')) xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
  xml = xml.replace(/\n?\s*<!-- STATIC-BLOG:START -->[\s\S]*?<!-- STATIC-BLOG:END -->\s*/g,'\n');
  const unique = [...new Map(generated.map(g => [g.url,g])).values()];
  const block = `\n  <!-- STATIC-BLOG:START -->\n${unique.map(g => `  <url><loc>${escapeXml(g.url)}</loc>${g.date ? `<lastmod>${escapeXml(g.date.slice(0,10))}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n  <!-- STATIC-BLOG:END -->\n`;
  xml = xml.replace(/<\/urlset>\s*$/i, `${block}</urlset>\n`);
  await fs.writeFile(sitemapPath,xml,'utf8');
}

function sanitizeHtml(html) { return html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<iframe[\s\S]*?<\/iframe>/gi,'').replace(/\son\w+\s*=\s*(["']).*?\1/gi,'').replace(/javascript:/gi,'').trim(); }
function cleanText(v) { return String(v || '').replace(/\s+/g,' ').trim(); }
function toIso(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(v) { return escapeHtml(v); }
function escapeXml(v) { return escapeHtml(v); }
function safeJson(v) { return JSON.stringify(v).replace(/</g,'\\u003c'); }
function formatDate(v, code) { try { return new Intl.DateTimeFormat(code === 'pt' ? 'pt-BR' : code === 'es' ? 'es-ES' : 'en-US',{dateStyle:'long',timeZone:'UTC'}).format(new Date(v)); } catch { return v.slice(0,10); } }
function styles() { return `:root{--bg:#0a0810;--card:#12101a;--line:rgba(255,255,255,.09);--text:#ece9f2;--muted:#a7a4b6;--p:#9b5cff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 system-ui,-apple-system,Segoe UI,sans-serif}.top{display:flex;justify-content:space-between;align-items:center;padding:18px max(20px,calc((100% - 900px)/2));border-bottom:1px solid var(--line)}a{color:#c9b0ff}.brand{font-weight:900;color:#fff;text-decoration:none;letter-spacing:.02em}.brand span{color:var(--p)}.back{font-size:14px}main{width:min(900px,calc(100% - 32px));margin:auto}article{padding:60px 0}.eyebrow{color:#c9b0ff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}h1{font-size:clamp(36px,7vw,64px);line-height:1.08;margin:10px 0 18px}.dek{font-size:20px;color:var(--muted);line-height:1.55}.meta{color:#8a8698;margin:20px 0 36px}.content h2{font-size:30px;margin-top:48px}.content h3{font-size:21px;margin-top:30px}.content p,.content li{color:#d4d0dc}.content a{overflow-wrap:anywhere}.content blockquote{border-left:3px solid var(--p);margin-left:0;padding:10px 18px;background:rgba(155,92,255,.06)}.cta{margin-top:54px;padding:24px;border:1px solid var(--line);border-radius:16px;background:var(--card)}.cta strong{font-size:22px}.cta p{color:var(--muted)}.cta a{display:inline-block;padding:10px 14px;border-radius:10px;background:#7B3FE4;color:white;text-decoration:none;font-weight:700}footer{border-top:1px solid var(--line);padding:28px;text-align:center;color:#8a8698}.article-list{list-style:none;padding:0}.article-list li{margin:12px 0}.article-list a{display:block;padding:18px;border:1px solid var(--line);border-radius:14px;text-decoration:none;background:var(--card)}.article-list strong{display:block;color:#fff;font-size:18px}.article-list span{display:block;color:var(--muted);margin-top:5px}`; }
