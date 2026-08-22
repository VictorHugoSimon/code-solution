import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'content', 'blog');
const indexPath = path.join(dir, 'index.json');
const check = process.argv.includes('--check');
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
const seen = new Set();
const posts = [];
const errors = [];
const warnings = [];

for (const file of files) {
  let article;
  try { article = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')); }
  catch (error) { errors.push(`${file}: JSON inválido (${error.message})`); continue; }
  const pt = article.pt || {};
  const slug = String(article.slug || pt.slug || '').trim();
  if (!slug) { errors.push(`${file}: slug ausente`); continue; }
  if (seen.has(slug)) { errors.push(`${file}: slug duplicado ${slug}`); continue; }
  seen.add(slug);
  const serialized = JSON.stringify(article);
  if (/Ã.|Â.|â€|�/.test(serialized)) {
    warnings.push(`${file}: possível mojibake; artigo excluído do índice até correção`);
    continue;
  }
  const bodyHtml = String(pt.bodyHtml || pt.body || '').trim();
  if (!pt.title || !pt.excerpt || !bodyHtml) { errors.push(`${file}: campos PT obrigatórios ausentes`); continue; }
  const locale = (code) => {
    const source = article[code] || {};
    return {
      title: source.title || pt.title,
      slug,
      excerpt: source.excerpt || pt.excerpt,
      category: source.category || pt.category || article.cat || '',
      readingTime: source.readingTime || pt.readingTime || '',
      metaDescription: source.metaDescription || source.excerpt || pt.metaDescription || pt.excerpt,
      keywords: Array.isArray(source.keywords) ? source.keywords : [],
      bodyHtml: String(source.bodyHtml || source.body || bodyHtml),
    };
  };
  posts.push({
    slug,
    date: article.date || null,
    title: pt.title,
    excerpt: pt.excerpt,
    category: pt.category || article.cat || '',
    readingTime: pt.readingTime || '',
    metaDescription: pt.metaDescription || pt.excerpt,
    keywords: Array.isArray(pt.keywords) ? pt.keywords : [],
    bodyHtml,
    pt: locale('pt'), en: locale('en'), es: locale('es'), social: article.social || {},
  });
}
posts.sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
const output = JSON.stringify(posts, null, 2) + '\n';
if (warnings.length) console.warn(warnings.join('\n'));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
if (check) {
  let current = '';
  try { current = await fs.readFile(indexPath, 'utf8'); } catch {}
  if (current !== output) { console.error('content/blog/index.json está desatualizado. Execute: npm run blog:index'); process.exitCode = 1; }
} else {
  await fs.writeFile(indexPath, output, 'utf8');
  console.log(`Índice atualizado: ${posts.length} artigo(s), ${warnings.length} em quarentena.`);
}
