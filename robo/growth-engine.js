import { generateJson } from './ai-client.js';

const BRAND_URL = 'https://www.codesolution.com.br';
const BLOG_INDEX_URL = 'https://raw.githubusercontent.com/VictorHugoSimon/code-solution/main/content/blog/index.json';
const RADAR_QUERIES = [
  'transformação digital empresas Brasil',
  'implantação ERP empresa Brasil',
  'automação logística empresa Brasil',
  'e-commerce expansão empresa Brasil',
  'integração de sistemas empresa Brasil',
  'inteligência artificial empresas Brasil',
  'tecnologia agronegócio empresa Brasil',
  'modernização sistemas legados empresa Brasil',
];
const PILLARS = [
  'Desenvolvimento de software sob medida',
  'Automação de processos',
  'Integrações e APIs',
  'IA aplicada ao negócio',
  'Dados, BI e painéis',
  'E-commerce e operações digitais',
  'Logística e transportes',
  'Tecnologia para o agronegócio',
];
const EXPERIENCE_PATTERNS = [
  'integrações entre sistemas, marketplaces, ERPs e operações digitais',
  'produtos digitais para logística e transportes',
  'e-commerce e evolução de presença digital',
  'dashboards, dados e visão executiva',
  'automação de suporte e atendimento com inteligência artificial',
  'modernização de fluxos manuais com software sob medida',
];

export async function runDailyGrowth(env, meta = {}) {
  requireDb(env);
  const radar = await runRadarAgent(env, meta);
  const social = await runSocialAgent(env, meta);
  const metrics = await snapshotGrowthMetrics(env);
  return { radar, social, metrics };
}

export async function runRadarAgent(env, meta = {}) {
  requireDb(env);
  return withRun(env, 'radar', meta.trigger || 'cron', async () => {
    const rawSignals = await collectSignals();
    const candidates = rawSignals.slice(0, 40);
    if (!candidates.length) return { scanned: 0, prospectsSaved: 0, topicsSaved: 0 };

    const system = `Você é o Agente Radar B2B da Code Solution, software house brasileira. Analise apenas os sinais fornecidos. Não invente empresa, domínio, pessoa, contato, número ou fato que não esteja explícito. Priorize empresas brasileiras com sinais reais de expansão, digitalização, integração, automação, e-commerce, logística, dados, IA ou modernização de sistemas. Responda somente JSON válido.`;
    const prompt = `Classifique os sinais públicos abaixo para oportunidades comerciais e pautas de conteúdo da Code Solution.\n\nICP principal: empresas B2B/B2C pequenas e médias ou operações em crescimento, especialmente Agro, Logística/Transportes, Varejo/E-commerce, Indústria e Serviços.\n\nRetorne no máximo 12 prospects e 10 pautas. Se um item não citar claramente uma empresa, não crie prospect para ele. Não invente domínio. Mensagens sugeridas devem ser consultivas, sem spam, sem dizer que sabemos dados privados.\n\nSchema: {"prospects":[{"company":"","domain":"","segment":"","location":"","sourceUrl":"","sourceTitle":"","signalType":"expansao|integracao|automacao|ecommerce|logistica|dados|ia|modernizacao|outro","signalText":"","score":0,"priority":"alta|media|baixa","outreachAngle":"","suggestedMessage":""}],"topics":[{"topic":"","pillar":"","keyword":"","intent":"informacional|problema|solucao|comparacao|decisao","score":0,"rationale":"","sourceUrl":""}]}\n\nPilares permitidos: ${PILLARS.join(' | ')}.\n\nSinais:\n${candidates.map((item, i) => `${i + 1}. ${item.title}\nFonte: ${item.link}\nData: ${item.pubDate || 'não informada'}\nContexto: ${item.description || ''}`).join('\n\n')}`;

    const result = await generateJson(env, system, prompt, { temperature: 0.25, maxTokens: 2600 });
    const prospects = Array.isArray(result.prospects) ? result.prospects : [];
    const topics = Array.isArray(result.topics) ? result.topics : [];
    let prospectsSaved = 0;
    let topicsSaved = 0;
    for (const item of prospects.slice(0, 12)) prospectsSaved += await saveProspect(env, item);
    for (const item of topics.slice(0, 10)) topicsSaved += await saveTopic(env, item);
    return { scanned: candidates.length, prospectsSaved, topicsSaved };
  });
}

export async function runSocialAgent(env, meta = {}) {
  requireDb(env);
  return withRun(env, 'social', meta.trigger || 'cron', async () => {
    const existing = await env.CRM_DB.prepare("SELECT COUNT(*) c FROM growth_content WHERE date(created_at)=date('now') AND status='pronto'").first();
    if (Number(existing?.c || 0) >= 4) return { created: 0, reason: 'daily_queue_already_exists' };

    const [topicsResult, accountsResult, latestArticle] = await Promise.all([
      env.CRM_DB.prepare("SELECT id,topic,pillar,keyword,intent,score,rationale,source_url FROM growth_topics WHERE status='aberto' ORDER BY score DESC, created_at DESC LIMIT 5").all(),
      env.CRM_DB.prepare("SELECT company,segment,signal_type,signal_text,score,source_url FROM growth_accounts WHERE status IN ('novo','qualificar') ORDER BY score DESC, updated_at DESC LIMIT 5").all(),
      loadLatestArticle(),
    ]);
    const topics = topicsResult.results || [];
    const accounts = accountsResult.results || [];
    const system = `Você é o Agente de Conteúdo Orgânico da Code Solution. Crie conteúdo B2B útil, específico e com ponto de vista próprio. Não invente estatísticas. Não exponha prospects pelo nome em posts. Não use linguagem de vendedor agressivo. O objetivo é gerar autoridade, conversa e demanda qualificada. Responda somente JSON válido.`;
    const prompt = `Crie a fila orgânica de hoje para a Code Solution.\n\nExperiência que pode orientar exemplos sem inventar resultados: ${EXPERIENCE_PATTERNS.join('; ')}.\n\nPautas recentes: ${JSON.stringify(topics)}\nSinais de mercado anonimizáveis: ${JSON.stringify(accounts.map(a => ({segment:a.segment,signalType:a.signal_type,signalText:a.signal_text,score:a.score})))}\nArtigo mais recente: ${JSON.stringify(latestArticle)}\n\nRegras:\n- LinkedIn pessoal: opinião prática de liderança/tecnologia, 700-1400 caracteres, abertura forte, 1 pergunta no final.\n- LinkedIn empresa: educativo, 600-1200 caracteres, 3-5 bullets quando útil, CTA leve para diagnóstico.\n- Instagram: 350-800 caracteres, didático, sem excesso de hashtags.\n- Facebook: 350-800 caracteres, linguagem clara para empresário.\n- Nunca use mais de 5 hashtags.\n- Inclua UTM sugerida quando houver CTA para o site.\n\nSchema: {"posts":[{"kind":"post","channel":"linkedin_pessoal|linkedin_empresa|instagram|facebook","title":"","body":"","cta":"","topicId":"","metadata":{"hashtags":"","recommendedTime":"","utm":""}}]}`;
    const result = await generateJson(env, system, prompt, { temperature: 0.55, maxTokens: 2400 });
    const posts = Array.isArray(result.posts) ? result.posts : [];
    let created = 0;
    for (const post of posts.slice(0, 6)) created += await saveContent(env, post);
    return { created };
  });
}

export async function runWeeklyPlanAgent(env, meta = {}) {
  requireDb(env);
  return withRun(env, 'planejamento', meta.trigger || 'cron', async () => {
    const accounts = await env.CRM_DB.prepare("SELECT segment,signal_type,signal_text,score,source_url FROM growth_accounts WHERE discovered_at >= datetime('now','-14 days') ORDER BY score DESC LIMIT 30").all();
    const existing = await env.CRM_DB.prepare("SELECT topic,pillar,keyword,score,status FROM growth_topics ORDER BY created_at DESC LIMIT 40").all();
    const system = `Você é o estrategista de crescimento orgânico da Code Solution. Planeje conteúdo que ajude decisores e gere demanda, não conteúdo genérico feito para robôs. Use os sinais reais fornecidos e a experiência da Code Solution. Responda apenas JSON válido.`;
    const prompt = `Crie 12 pautas para as próximas 4 semanas. Distribua entre topo, meio e fundo de funil e entre os pilares permitidos. Evite duplicar pautas existentes.\n\nPilares: ${PILLARS.join(' | ')}\nExperiência prática: ${EXPERIENCE_PATTERNS.join('; ')}\nSinais: ${JSON.stringify(accounts.results || [])}\nPautas já existentes: ${JSON.stringify(existing.results || [])}\n\nDê prioridade a perguntas que um CEO, diretor comercial, operações ou tecnologia pesquisaria antes de contratar software sob medida, integração, automação ou IA.\nSchema: {"topics":[{"topic":"","pillar":"","keyword":"","intent":"informacional|problema|solucao|comparacao|decisao","score":0,"rationale":"","sourceUrl":""}]}`;
    const result = await generateJson(env, system, prompt, { temperature: 0.35, maxTokens: 2200 });
    let saved = 0;
    for (const item of (Array.isArray(result.topics) ? result.topics : []).slice(0, 12)) saved += await saveTopic(env, item);
    return { saved };
  });
}

export async function pickGrowthTopic(env) {
  if (!env.CRM_DB) return null;
  const row = await env.CRM_DB.prepare("SELECT id,topic,pillar,keyword,intent,score,rationale,source_url FROM growth_topics WHERE status='aberto' ORDER BY score DESC, created_at ASC LIMIT 1").first();
  if (!row) return null;
  return { id: row.id, category: row.pillar, keyword: row.keyword || row.topic, topic: row.topic, intent: row.intent, rationale: row.rationale, sourceUrl: row.source_url };
}

export async function markGrowthTopicUsed(env, id, articleSlug) {
  if (!env.CRM_DB || !id) return;
  const now = new Date().toISOString();
  await env.CRM_DB.prepare("UPDATE growth_topics SET status='publicado', updated_at=? WHERE id=?").bind(now, id).run();
  if (articleSlug) {
    await env.CRM_DB.prepare("INSERT INTO growth_content (id,kind,channel,title,body,cta,source_article_slug,source_topic_id,status,created_at,updated_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), 'artigo', 'blog', articleSlug, `Artigo publicado: ${articleSlug}`, BRAND_URL, articleSlug, id, 'publicado', now, now, JSON.stringify({ automatic: true })).run();
  }
}

export async function getGrowthStatus(env) {
  if (!env.CRM_DB) return { ok: false, storage: 'not_configured' };
  const [accounts, hot, content, topics, runs] = await Promise.all([
    env.CRM_DB.prepare("SELECT COUNT(*) c FROM growth_accounts WHERE status NOT IN ('descartado','convertido')").first(),
    env.CRM_DB.prepare("SELECT COUNT(*) c FROM growth_accounts WHERE score>=75 AND status NOT IN ('descartado','convertido')").first(),
    env.CRM_DB.prepare("SELECT COUNT(*) c FROM growth_content WHERE status='pronto'").first(),
    env.CRM_DB.prepare("SELECT COUNT(*) c FROM growth_topics WHERE status='aberto'").first(),
    env.CRM_DB.prepare("SELECT agent,status,started_at,completed_at,error_text FROM growth_runs ORDER BY started_at DESC LIMIT 8").all(),
  ]);
  return {
    ok: true,
    prospects: Number(accounts?.c || 0),
    highIntent: Number(hot?.c || 0),
    contentReady: Number(content?.c || 0),
    topicsOpen: Number(topics?.c || 0),
    recentRuns: runs.results || [],
  };
}

export async function snapshotGrowthMetrics(env) {
  if (!env.CRM_DB) return null;
  const date = saoPauloDate(new Date());
  const [prospects, hot, content, articles, leads, hotLeads, organic] = await Promise.all([
    scalar(env, "SELECT COUNT(*) c FROM growth_accounts WHERE date(discovered_at)=date('now')"),
    scalar(env, "SELECT COUNT(*) c FROM growth_accounts WHERE score>=75 AND status NOT IN ('descartado','convertido')"),
    scalar(env, "SELECT COUNT(*) c FROM growth_content WHERE status='pronto'"),
    scalar(env, "SELECT COUNT(*) c FROM growth_content WHERE kind='artigo' AND status='publicado' AND date(created_at)=date('now')"),
    scalar(env, 'SELECT COUNT(*) c FROM leads'),
    scalar(env, "SELECT COUNT(*) c FROM leads WHERE temperature='quente'"),
    scalar(env, "SELECT COUNT(*) c FROM leads WHERE lower(COALESCE(source,'')) IN ('google','linkedin','instagram','facebook','organic','organico','blog') OR lower(COALESCE(medium,''))='organic'"),
  ]);
  const now = new Date().toISOString();
  const id = `metric:${date}`;
  await env.CRM_DB.prepare(`INSERT INTO growth_metrics (id,metric_date,prospects_discovered,high_intent_prospects,content_ready,articles_published,crm_leads,crm_hot_leads,organic_leads,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(metric_date) DO UPDATE SET prospects_discovered=excluded.prospects_discovered,high_intent_prospects=excluded.high_intent_prospects,content_ready=excluded.content_ready,articles_published=excluded.articles_published,crm_leads=excluded.crm_leads,crm_hot_leads=excluded.crm_hot_leads,organic_leads=excluded.organic_leads,created_at=excluded.created_at`)
    .bind(id, date, prospects, hot, content, articles, leads, hotLeads, organic, now).run();
  return { date, prospects, hot, content, articles, leads, hotLeads, organic };
}

async function collectSignals() {
  const settled = await Promise.allSettled(RADAR_QUERIES.map(fetchGoogleNews));
  const items = [];
  for (const result of settled) if (result.status === 'fulfilled') items.push(...result.value);
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.link}|${item.title}`;
    if (!item.title || !item.link || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => String(b.pubDate || '').localeCompare(String(a.pubDate || '')));
}

async function fetchGoogleNews(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const response = await fetch(url, { headers: { 'User-Agent': 'CodeSolutionGrowthRadar/1.0' }, cf: { cacheTtl: 900 } });
  if (!response.ok) throw new Error(`rss_${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8).map((match) => {
    const block = match[1];
    return {
      title: decodeXml(tag(block, 'title')),
      link: decodeXml(tag(block, 'link')),
      pubDate: decodeXml(tag(block, 'pubDate')),
      description: stripHtml(decodeXml(tag(block, 'description'))).slice(0, 700),
      query,
    };
  }).filter((x) => x.title && x.link);
}

async function saveProspect(env, input) {
  const company = clean(input.company, 180);
  const sourceUrl = validUrl(input.sourceUrl);
  if (!company || !sourceUrl) return 0;
  const now = new Date().toISOString();
  const score = clampScore(input.score);
  const priority = ['alta','media','baixa'].includes(String(input.priority).toLowerCase()) ? String(input.priority).toLowerCase() : (score >= 75 ? 'alta' : score >= 50 ? 'media' : 'baixa');
  const id = crypto.randomUUID();
  await env.CRM_DB.prepare(`INSERT INTO growth_accounts (id,company,domain,segment,location,source_url,source_title,signal_type,signal_text,score,priority,status,outreach_angle,suggested_message,discovered_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_url,company) DO UPDATE SET domain=excluded.domain,segment=excluded.segment,location=excluded.location,source_title=excluded.source_title,signal_type=excluded.signal_type,signal_text=excluded.signal_text,score=MAX(growth_accounts.score,excluded.score),priority=excluded.priority,outreach_angle=excluded.outreach_angle,suggested_message=excluded.suggested_message,updated_at=excluded.updated_at`)
    .bind(id, company, clean(input.domain, 180) || null, clean(input.segment, 120) || null, clean(input.location, 120) || null, sourceUrl, clean(input.sourceTitle, 300) || null, clean(input.signalType, 60) || 'outro', clean(input.signalText, 1200) || null, score, priority, 'novo', clean(input.outreachAngle, 800) || null, clean(input.suggestedMessage, 1200) || null, now, now).run();
  return 1;
}

async function saveTopic(env, input) {
  const topic = clean(input.topic, 220);
  const keyword = clean(input.keyword || input.topic, 180);
  if (!topic || !keyword) return 0;
  const existing = await env.CRM_DB.prepare("SELECT id FROM growth_topics WHERE lower(keyword)=lower(?) AND status IN ('aberto','publicado') LIMIT 1").bind(keyword).first();
  if (existing) return 0;
  const pillar = PILLARS.includes(clean(input.pillar, 120)) ? clean(input.pillar, 120) : inferPillar(topic);
  const now = new Date().toISOString();
  await env.CRM_DB.prepare("INSERT INTO growth_topics (id,topic,pillar,keyword,intent,score,rationale,source_url,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), topic, pillar, keyword, clean(input.intent, 40) || 'problema', clampScore(input.score), clean(input.rationale, 900) || null, validUrl(input.sourceUrl) || null, 'aberto', now, now).run();
  return 1;
}

async function saveContent(env, input) {
  const channel = clean(input.channel, 60);
  const body = cleanMultiline(input.body, 6000);
  if (!channel || !body) return 0;
  const now = new Date().toISOString();
  const topicId = clean(input.topicId, 80) || null;
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  await env.CRM_DB.prepare("INSERT INTO growth_content (id,kind,channel,title,body,cta,source_article_slug,source_topic_id,status,scheduled_for,published_at,created_at,updated_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), clean(input.kind, 40) || 'post', channel, clean(input.title, 220) || null, body, clean(input.cta, 700) || null, clean(input.sourceArticleSlug, 120) || null, topicId, 'pronto', null, null, now, now, JSON.stringify(metadata).slice(0, 4000)).run();
  return 1;
}

async function loadLatestArticle() {
  try {
    const response = await fetch(BLOG_INDEX_URL, { cf: { cacheTtl: 300 } });
    if (!response.ok) return null;
    const items = await response.json();
    const first = Array.isArray(items) ? items[0] : null;
    if (!first) return null;
    const slug = first.slug || first?.pt?.slug;
    return { title: first.title || first?.pt?.title || '', slug, category: first.category || first?.pt?.category || '', url: slug ? `${BRAND_URL}/blog/${slug}/` : '' };
  } catch { return null; }
}

async function withRun(env, agent, trigger, fn) {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await env.CRM_DB.prepare("INSERT INTO growth_runs (id,agent,trigger_type,status,started_at) VALUES (?,?,?,?,?)").bind(id, agent, trigger, 'running', startedAt).run();
  try {
    const summary = await fn();
    const completedAt = new Date().toISOString();
    await env.CRM_DB.prepare("UPDATE growth_runs SET status='success',completed_at=?,summary_json=? WHERE id=?").bind(completedAt, JSON.stringify(summary).slice(0, 6000), id).run();
    return summary;
  } catch (error) {
    const completedAt = new Date().toISOString();
    await env.CRM_DB.prepare("UPDATE growth_runs SET status='failed',completed_at=?,error_text=? WHERE id=?").bind(completedAt, String(error?.message || error).slice(0, 800), id).run();
    throw error;
  }
}

async function scalar(env, sql) {
  const row = await env.CRM_DB.prepare(sql).first();
  return Number(row?.c || 0);
}

function requireDb(env) {
  if (!env.CRM_DB) throw new Error('growth_db_not_configured');
}
function clampScore(value) { return Math.max(0, Math.min(100, Math.round(Number(value || 0)))); }
function clean(value, max = 500) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanMultiline(value, max = 6000) { return String(value || '').replace(/\r/g, '').trim().slice(0, max); }
function validUrl(value) { try { const u = new URL(String(value || '')); return ['http:','https:'].includes(u.protocol) ? u.toString().slice(0, 1000) : ''; } catch { return ''; } }
function inferPillar(text) { const t = String(text).toLowerCase(); if (t.includes('log')) return 'Logística e transportes'; if (t.includes('agro')) return 'Tecnologia para o agronegócio'; if (t.includes('e-commerce') || t.includes('varejo')) return 'E-commerce e operações digitais'; if (t.includes('ia') || t.includes('intelig')) return 'IA aplicada ao negócio'; if (t.includes('api') || t.includes('integra')) return 'Integrações e APIs'; if (t.includes('dados') || t.includes('bi')) return 'Dados, BI e painéis'; if (t.includes('autom')) return 'Automação de processos'; return 'Desenvolvimento de software sob medida'; }
function tag(block, name) { const m = String(block).match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i')); return m ? m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '') : ''; }
function decodeXml(value) { return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function stripHtml(value) { return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function saoPauloDate(date) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const get = (type) => parts.find((p) => p.type === type)?.value; return `${get('year')}-${get('month')}-${get('day')}`; }
