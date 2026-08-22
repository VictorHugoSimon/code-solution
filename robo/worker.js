const GITHUB_OWNER = 'VictorHugoSimon';
const GITHUB_REPO = 'code-solution';
const GITHUB_BRANCH = 'main';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

const TOPICS = [
  { category: 'Inteligência Artificial', keyword: 'inteligência artificial para empresas' },
  { category: 'Automação', keyword: 'automação de processos' },
  { category: 'Dados & BI', keyword: 'banco de dados e BI' },
  { category: 'Segurança', keyword: 'cibersegurança e LGPD' },
  { category: 'Desenvolvimento', keyword: 'desenvolvimento de software sob medida' },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'code-solution-robo', model: env.AI_MODEL || DEFAULT_MODEL, now: new Date().toISOString() });
    }
    if (url.pathname === '/run') {
      if (!safeEqual(url.searchParams.get('key') || '', env.MANUAL_KEY || '')) return json({ ok: false, error: 'unauthorized' }, 401);
      try {
        const result = await runPipeline(env, ctx, { trigger: 'manual' });
        return json({ ok: true, ...result });
      } catch (error) {
        console.error('manual run failed', error);
        return json({ ok: false, error: cleanError(error) }, 500);
      }
    }
    return json({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runPipeline(env, ctx, { trigger: 'cron' }).catch((error) => console.error('scheduled run failed', error)));
  },
};

async function runPipeline(env, ctx, meta) {
  requireEnv(env, ['AI_API_KEY', 'GITHUB_TOKEN']);
  const index = await loadIndex(env);
  const topic = pickTopic(index);
  const draft = await generateArticle(env, topic);
  const article = normalizeAndValidate(draft, topic, index);
  await upsertArticle(env, article);
  const nextIndex = [toIndexItem(article), ...index.filter((p) => p.slug !== article.slug)]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 250);
  await putGithubJson(env, 'content/blog/index.json', nextIndex, `robô: atualiza índice com ${article.slug}`);
  if (env.GOOGLE_SA_EMAIL && env.GOOGLE_SA_KEY) {
    ctx.waitUntil(requestGoogleIndexing(env, article.slug).catch((error) => console.warn('indexing skipped', cleanError(error))));
  }
  return { trigger: meta.trigger, slug: article.slug, category: article.pt.category, date: article.date };
}

function pickTopic(index) {
  const lastByCategory = new Map();
  for (const post of index) {
    const category = post.category || post?.pt?.category;
    if (!category || lastByCategory.has(category)) continue;
    lastByCategory.set(category, Date.parse(post.date || 0) || 0);
  }
  return [...TOPICS].sort((a, b) => (lastByCategory.get(a.category) || 0) - (lastByCategory.get(b.category) || 0))[0];
}

async function generateArticle(env, topic) {
  const system = `Você é o editor técnico da Code Solution, software house brasileira B2B. Escreva conteúdo útil para decisores de PMEs, sem hype, sem números inventados e sem alegações jurídicas absolutas. Responda APENAS JSON válido.`;
  const prompt = `Crie um artigo original em PT-BR sobre "${topic.keyword}". Depois traduza fielmente para inglês e espanhol.\n\nRequisitos:\n- 900 a 1300 palavras em português;\n- título específico e não genérico;\n- slug ASCII kebab-case;\n- resumo de 140-220 caracteres;\n- 5 a 8 palavras-chave;\n- HTML sem scripts, iframe, style ou eventos inline;\n- estrutura com h2, p, ul/ol quando útil;\n- um bloco de resposta direta no começo: <p><strong>Resposta direta:</strong> ...</p>;\n- FAQ com 3 perguntas no fim em h2/h3;\n- CTA final apontando para https://www.codesolution.com.br/;\n- não use links fictícios;\n- não mencione preços, multas ou estatísticas sem fonte;\n- crie legendas para LinkedIn, Instagram e Facebook.\n\nSchema exato: {"pt":{"title":"","slug":"","excerpt":"","category":"${topic.category}","readingTime":"","metaDescription":"","keywords":[],"body":""},"en":{...mesmos campos...},"es":{...mesmos campos...},"social":{"linkedin":{"caption":"","hashtags":""},"instagram":{"caption":"","hashtags":""},"facebook":{"caption":"","hashtags":""}}}`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.AI_MODEL || DEFAULT_MODEL,
      temperature: 0.65,
      max_tokens: 3600,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`groq_${response.status}:${(await response.text()).slice(0, 500)}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('groq_empty_response');
  try { return JSON.parse(content); } catch { throw new Error('groq_invalid_json'); }
}

function normalizeAndValidate(raw, topic, index) {
  const now = new Date().toISOString();
  const article = { ...raw, date: now };
  for (const locale of ['pt', 'en', 'es']) {
    if (!article[locale] || typeof article[locale] !== 'object') throw new Error(`missing_locale_${locale}`);
    article[locale].title = cleanText(article[locale].title);
    article[locale].excerpt = cleanText(article[locale].excerpt);
    article[locale].metaDescription = cleanText(article[locale].metaDescription);
    article[locale].category = cleanText(article[locale].category || topic.category);
    article[locale].readingTime = cleanText(article[locale].readingTime || '6 min');
    article[locale].keywords = Array.isArray(article[locale].keywords) ? article[locale].keywords.map(cleanText).filter(Boolean).slice(0, 12) : [];
    article[locale].body = sanitizeHtml(String(article[locale].body || article[locale].bodyHtml || ''));
    if (!article[locale].title || article[locale].body.length < 1200) throw new Error(`content_too_short_${locale}`);
    if (hasMojibake(JSON.stringify(article[locale]))) throw new Error(`encoding_error_${locale}`);
  }
  const baseSlug = slugify(article.pt.slug || article.pt.title);
  const used = new Set(index.map((p) => p.slug).filter(Boolean));
  article.slug = used.has(baseSlug) ? `${baseSlug}-${now.slice(0, 10)}` : baseSlug;
  for (const locale of ['pt', 'en', 'es']) article[locale].slug = article.slug;
  article.pt.category = topic.category;
  article.cat = topic.category;
  article.kw = topic.keyword;
  return article;
}

function toIndexItem(article) {
  const flatten = (locale) => ({
    title: article[locale].title,
    slug: article.slug,
    excerpt: article[locale].excerpt,
    category: article[locale].category,
    readingTime: article[locale].readingTime,
    metaDescription: article[locale].metaDescription,
    keywords: article[locale].keywords,
    bodyHtml: article[locale].body,
  });
  return {
    slug: article.slug,
    date: article.date,
    title: article.pt.title,
    excerpt: article.pt.excerpt,
    category: article.pt.category,
    readingTime: article.pt.readingTime,
    metaDescription: article.pt.metaDescription,
    keywords: article.pt.keywords,
    bodyHtml: article.pt.body,
    pt: flatten('pt'), en: flatten('en'), es: flatten('es'), social: article.social || {},
  };
}

async function loadIndex(env) {
  try {
    const result = await getGithubJson(env, 'content/blog/index.json');
    return Array.isArray(result) ? result : [];
  } catch (error) {
    if (String(error.message).includes('github_404')) return [];
    throw error;
  }
}

async function upsertArticle(env, article) {
  const path = `content/blog/${article.slug}.json`;
  const exists = await githubFileMeta(env, path);
  if (exists) throw new Error('slug_collision_after_normalization');
  await putGithubJson(env, path, article, `robô: novo artigo "${article.pt.title}"`);
}

async function githubFileMeta(env, path) {
  const response = await githubFetch(env, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`github_${response.status}:${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function getGithubJson(env, path) {
  const meta = await githubFileMeta(env, path);
  if (!meta) throw new Error('github_404');
  const text = decodeBase64(meta.content || '');
  return JSON.parse(text);
}

async function putGithubJson(env, path, value, message) {
  const existing = await githubFileMeta(env, path);
  const body = { message, content: encodeBase64(JSON.stringify(value, null, 2) + '\n'), branch: GITHUB_BRANCH };
  if (existing?.sha) body.sha = existing.sha;
  const response = await githubFetch(env, `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`github_put_${response.status}:${(await response.text()).slice(0, 500)}`);
  return response.json();
}

async function githubFetch(env, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Code-Solution-Content-Robot',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function requestGoogleIndexing(env, slug) {
  if (!env.GOOGLE_INDEXING_WEBHOOK) return;
  const response = await fetch(env.GOOGLE_INDEXING_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `https://www.codesolution.com.br/blog/#${slug}`, type: 'URL_UPDATED' }),
  });
  if (!response.ok) throw new Error(`indexing_${response.status}`);
}

function sanitizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function hasMojibake(value) { return /Ã.|Â.|â€|�/.test(value); }
function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function slugify(value) { return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || `artigo-${Date.now()}`; }
function encodePath(path) { return path.split('/').map(encodeURIComponent).join('/'); }
function encodeBase64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (const byte of bytes) bin += String.fromCharCode(byte); return btoa(bin); }
function decodeBase64(str) { const bin = atob(String(str).replace(/\s/g, '')); const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function safeEqual(a, b) { if (!a || !b || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function requireEnv(env, names) { for (const name of names) if (!env[name]) throw new Error(`missing_env_${name}`); }
function cleanError(error) { return String(error?.message || error || 'unknown_error').slice(0, 800); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
