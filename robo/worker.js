const GITHUB_OWNER = 'VictorHugoSimon';
const GITHUB_REPO = 'code-solution';
const GITHUB_BRANCH = 'main';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const BUILD_VERSION = 'commercial-engine-2026-08-22.2';

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
      return json({
        ok: true,
        service: 'code-solution-robo',
        build: BUILD_VERSION,
        model: env.AI_MODEL || DEFAULT_MODEL,
        ready: Boolean(env.AI_API_KEY && env.GITHUB_TOKEN),
        aiConfigured: Boolean(env.AI_API_KEY),
        githubConfigured: Boolean(env.GITHUB_TOKEN),
        manualRunConfigured: Boolean(env.MANUAL_KEY),
        now: new Date().toISOString(),
      });
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
  return { trigger: meta.trigger, slug: article.pt.slug || article.slug, category: article.pt.category, date: article.date };
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
  if (!response.ok) throw new Error(`Groq ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return JSON.parse(dataContent(await response.json()));
}

function normalizeAndValidate(draft, topic, index) {
  const now = new Date().toISOString();
  const pt = normalizeLocale(draft.pt, topic.category);
  const en = normalizeLocale(draft.en, topic.category, pt);
  const es = normalizeLocale(draft.es, topic.category, pt);
  const baseSlug = slugify(pt.slug || pt.title);
  if (!baseSlug) throw new Error('slug inválido');
  const recentSlugs = new Set(index.map((p) => p.slug || p?.pt?.slug).filter(Boolean));
  let slug = baseSlug;
  if (recentSlugs.has(slug)) slug = `${baseSlug}-${now.slice(0, 10)}`;
  pt.slug = slug; en.slug = slug; es.slug = slug;
  const article = { pt, en, es, social: normalizeSocial(draft.social), slug, cat: pt.category, kw: pt.keywords[0] || topic.keyword, date: now };
  validateArticle(article);
  return article;
}

function normalizeLocale(input = {}, fallbackCategory, fallback = {}) {
  return {
    title: cleanText(input.title || fallback.title),
    slug: slugify(input.slug || input.title || fallback.slug || fallback.title),
    excerpt: cleanText(input.excerpt || fallback.excerpt),
    category: cleanText(input.category || fallback.category || fallbackCategory),
    readingTime: cleanText(input.readingTime || fallback.readingTime || '8 min'),
    metaDescription: cleanText(input.metaDescription || input.excerpt || fallback.metaDescription || fallback.excerpt).slice(0, 220),
    keywords: Array.from(new Set((Array.isArray(input.keywords) ? input.keywords : fallback.keywords || []).map(cleanText).filter(Boolean))).slice(0, 10),
    body: sanitizeHtml(String(input.body || fallback.body || '')),
  };
}

function validateArticle(article) {
  for (const lang of ['pt', 'en', 'es']) {
    const item = article[lang];
    if (!item.title || item.title.length < 12) throw new Error(`${lang}.title inválido`);
    if (!item.excerpt || item.excerpt.length < 80) throw new Error(`${lang}.excerpt curto`);
    if (!item.body || item.body.length < 1800) throw new Error(`${lang}.body curto`);
    if (/Ã.|Â.|â€|�/.test(`${item.title} ${item.excerpt} ${item.body}`)) throw new Error(`${lang}: encoding inválido`);
    if (/<script|<iframe|javascript:|\son\w+=/i.test(item.body)) throw new Error(`${lang}: HTML inseguro`);
  }
}

async function loadIndex(env) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/content/blog/index.json?ref=${GITHUB_BRANCH}`, { headers: githubHeaders(env) });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`GitHub index ${response.status}`);
  const data = await response.json();
  return JSON.parse(decodeBase64Utf8(data.content || 'W10='));
}

async function upsertArticle(env, article) {
  const path = `content/blog/${article.slug}.json`;
  const existing = await githubGet(env, path);
  if (existing) throw new Error(`slug já existe no repositório: ${article.slug}`);
  await putGithubJson(env, path, article, `robô: novo artigo "${article.pt.title}"`);
}

async function putGithubJson(env, path, value, message) {
  const existing = await githubGet(env, path);
  const payload = { message, branch: GITHUB_BRANCH, content: encodeBase64Utf8(JSON.stringify(value, null, 2) + '\n') };
  if (existing?.sha) payload.sha = existing.sha;
  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT', headers: githubHeaders(env), body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`GitHub write ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.json();
}

async function githubGet(env, path) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`, { headers: githubHeaders(env) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub read ${response.status}`);
  return response.json();
}

function githubHeaders(env) {
  return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CodeSolutionContentBot' };
}

async function requestGoogleIndexing(env, slug) {
  const token = await googleAccessToken(env);
  for (const lang of ['', 'en/', 'es/']) {
    const url = `https://www.codesolution.com.br/${lang}blog/${slug}/`.replace(/([^:]\/)\/+/, '$1');
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    if (!response.ok) throw new Error(`Google indexing ${response.status}`);
  }
}

async function googleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: env.GOOGLE_SA_EMAIL, scope: 'https://www.googleapis.com/auth/indexing', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3500 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(env.GOOGLE_SA_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const assertion = `${header}.${claim}.${b64url(new Uint8Array(signature))}`;
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new Error(`Google token ${response.status}`);
  return (await response.json()).access_token;
}

function normalizeSocial(social = {}) {
  const out = {};
  for (const network of ['linkedin', 'instagram', 'facebook']) {
    const item = social[network] || {};
    out[network] = { caption: cleanText(item.caption), hashtags: cleanText(item.hashtags) };
  }
  return out;
}
function toIndexItem(article) { return { slug: article.slug, date: article.date, title: article.pt.title, excerpt: article.pt.excerpt, category: article.pt.category, readingTime: article.pt.readingTime, metaDescription: article.pt.metaDescription, keywords: article.pt.keywords, bodyHtml: article.pt.body, pt: { ...article.pt, bodyHtml: article.pt.body }, en: { ...article.en, bodyHtml: article.en.body }, es: { ...article.es, bodyHtml: article.es.body }, social: article.social }; }
function sanitizeHtml(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<iframe[\s\S]*?<\/iframe>/gi, '').replace(/\son\w+\s*=\s*(["']).*?\1/gi, '').replace(/javascript:/gi, '').trim(); }
function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function slugify(value) { return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90); }
function dataContent(data) { const content = data?.choices?.[0]?.message?.content; if (!content) throw new Error('Groq sem conteúdo'); return content; }
function cleanError(error) { return String(error?.message || error).replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]').slice(0, 500); }
function requireEnv(env, names) { for (const name of names) if (!env[name]) throw new Error(`configuração ausente: ${name}`); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function safeEqual(a, b) { if (!a || !b || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function encodeBase64Utf8(value) { const bytes = new TextEncoder().encode(value); let binary = ''; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary); }
function decodeBase64Utf8(value) { const binary = atob(String(value).replace(/\n/g, '')); const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function b64url(value) { const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value; let binary=''; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function pemToArrayBuffer(pem) { const clean = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, ''); const bin = atob(clean); return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer; }
