import { generateJson } from './ai-client.js';

const QUERIES = [
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

export async function runRadarAgentRobust(env, meta = {}) {
  if (!env.CRM_DB) throw new Error('growth_db_not_configured');
  return withRun(env, meta.trigger || 'cron', async () => {
    const signals = await collectSignals();
    const candidates = signals.slice(0, 48);
    if (!candidates.length) throw new Error('radar_sources_returned_zero_items');

    const system = `Você é o Agente Radar B2B da Code Solution, software house brasileira. Analise SOMENTE os sinais públicos fornecidos. Não invente empresa, domínio, contato, pessoa, cargo, telefone, e-mail, número ou fato. Priorize empresas brasileiras com sinais concretos de expansão, digitalização, integração, automação, e-commerce, logística, dados, IA ou modernização de sistemas. Empresas muito grandes podem virar sinal editorial, mas priorize como prospect operações onde uma software house especializada possa ter acesso comercial plausível. Responda somente JSON válido.`;
    const prompt = `Analise os sinais abaixo e retorne prospects B2B e pautas de conteúdo.\n\nICP: empresas pequenas e médias ou operações em crescimento, especialmente Agro, Logística/Transportes, Varejo/E-commerce, Indústria e Serviços.\n\nRegras:\n- no máximo 12 prospects;\n- no máximo 10 pautas;\n- só crie prospect quando o título/contexto citar claramente uma empresa;\n- sourceUrl deve ser exatamente uma URL presente no sinal correspondente;\n- não invente domínio: deixe vazio quando não estiver explícito;\n- score 0-100 mede aderência + intensidade do sinal + plausibilidade comercial;\n- mensagem sugerida deve ser consultiva e personalizada pelo sinal público, sem fingir conhecimento privado;\n- nunca sugira spam ou disparo em massa.\n\nSchema: {"prospects":[{"company":"","domain":"","segment":"","location":"","sourceUrl":"","sourceTitle":"","signalType":"expansao|integracao|automacao|ecommerce|logistica|dados|ia|modernizacao|outro","signalText":"","score":0,"priority":"alta|media|baixa","outreachAngle":"","suggestedMessage":""}],"topics":[{"topic":"","pillar":"","keyword":"","intent":"informacional|problema|solucao|comparacao|decisao","score":0,"rationale":"","sourceUrl":""}]}\n\nPilares permitidos: ${PILLARS.join(' | ')}\n\nSINAIS:\n${candidates.map((x, i) => `${i + 1}. ${x.title}\nFonte agregadora: ${x.provider}\nURL: ${x.link}\nData: ${x.pubDate || 'não informada'}\nContexto: ${x.description || ''}`).join('\n\n')}`;

    const result = await generateJson(env, system, prompt, { temperature: 0.2, maxTokens: 3400 });
    const prospects = Array.isArray(result.prospects) ? result.prospects : [];
    const topics = Array.isArray(result.topics) ? result.topics : [];
    let prospectsSaved = 0;
    let topicsSaved = 0;
    for (const item of prospects.slice(0, 12)) prospectsSaved += await saveProspect(env, item, candidates);
    for (const item of topics.slice(0, 10)) topicsSaved += await saveTopic(env, item, candidates);
    return {
      scanned: candidates.length,
      providers: [...new Set(candidates.map((x) => x.provider))],
      prospectsSuggested: prospects.length,
      prospectsSaved,
      topicsSuggested: topics.length,
      topicsSaved,
    };
  });
}

async function collectSignals() {
  const tasks = [];
  for (const query of QUERIES) {
    tasks.push(fetchBingNews(query));
    tasks.push(fetchGoogleNews(query));
  }
  const settled = await Promise.allSettled(tasks);
  const items = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') items.push(...result.value);
  }
  const seen = new Set();
  return items.filter((item) => {
    const normalizedTitle = String(item.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const key = `${item.link}|${normalizedTitle}`;
    if (!normalizedTitle || !item.link || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => dateValue(b.pubDate) - dateValue(a.pubDate));
}

async function fetchBingNews(query) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS&setlang=pt-br&cc=br`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 CodeSolutionGrowthRadar/1.1' },
    cf: { cacheTtl: 900 },
  });
  if (!response.ok) throw new Error(`bing_rss_${response.status}`);
  return parseRss(await response.text(), query, 'bing');
}

async function fetchGoogleNews(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 CodeSolutionGrowthRadar/1.1' },
    cf: { cacheTtl: 900 },
  });
  if (!response.ok) throw new Error(`google_rss_${response.status}`);
  return parseRss(await response.text(), query, 'google');
}

function parseRss(xml, query, provider) {
  const items = [...String(xml || '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.slice(0, 10).map((match) => {
    const block = match[1];
    const rawLink = decodeXml(tag(block, 'link'));
    return {
      title: stripHtml(decodeXml(tag(block, 'title'))).slice(0, 400),
      link: normalizeNewsLink(rawLink),
      pubDate: stripHtml(decodeXml(tag(block, 'pubDate'))).slice(0, 100),
      description: stripHtml(decodeXml(tag(block, 'description'))).slice(0, 900),
      query,
      provider,
    };
  }).filter((x) => x.title && /^https?:\/\//i.test(x.link));
}

async function saveProspect(env, input, candidates) {
  const company = clean(input.company, 180);
  const sourceUrl = sourceUrlAllowed(input.sourceUrl, candidates);
  if (!company || !sourceUrl) return 0;
  const now = new Date().toISOString();
  const score = clampScore(input.score);
  const priorityInput = String(input.priority || '').toLowerCase();
  const priority = ['alta','media','baixa'].includes(priorityInput) ? priorityInput : (score >= 75 ? 'alta' : score >= 50 ? 'media' : 'baixa');
  await env.CRM_DB.prepare(`INSERT INTO growth_accounts (id,company,domain,segment,location,source_url,source_title,signal_type,signal_text,score,priority,status,outreach_angle,suggested_message,discovered_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_url,company) DO UPDATE SET domain=excluded.domain,segment=excluded.segment,location=excluded.location,source_title=excluded.source_title,signal_type=excluded.signal_type,signal_text=excluded.signal_text,score=MAX(growth_accounts.score,excluded.score),priority=excluded.priority,outreach_angle=excluded.outreach_angle,suggested_message=excluded.suggested_message,updated_at=excluded.updated_at`)
    .bind(
      crypto.randomUUID(), company, clean(input.domain, 180) || null, clean(input.segment, 120) || null,
      clean(input.location, 120) || null, sourceUrl, clean(input.sourceTitle, 300) || null,
      clean(input.signalType, 60) || 'outro', clean(input.signalText, 1200) || null, score, priority, 'novo',
      clean(input.outreachAngle, 800) || null, clean(input.suggestedMessage, 1400) || null, now, now,
    ).run();
  return 1;
}

async function saveTopic(env, input, candidates) {
  const topic = clean(input.topic, 220);
  const keyword = clean(input.keyword || input.topic, 180);
  if (!topic || !keyword) return 0;
  const duplicate = await env.CRM_DB.prepare("SELECT id FROM growth_topics WHERE lower(keyword)=lower(?) AND status IN ('aberto','publicado') LIMIT 1").bind(keyword).first();
  if (duplicate) return 0;
  const pillarValue = clean(input.pillar, 120);
  const pillar = PILLARS.includes(pillarValue) ? pillarValue : inferPillar(topic);
  const now = new Date().toISOString();
  const sourceUrl = sourceUrlAllowed(input.sourceUrl, candidates) || null;
  await env.CRM_DB.prepare('INSERT INTO growth_topics (id,topic,pillar,keyword,intent,score,rationale,source_url,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), topic, pillar, keyword, clean(input.intent, 40) || 'problema', clampScore(input.score), clean(input.rationale, 1000) || null, sourceUrl, 'aberto', now, now).run();
  return 1;
}

async function withRun(env, trigger, fn) {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await env.CRM_DB.prepare('INSERT INTO growth_runs (id,agent,trigger_type,status,started_at) VALUES (?,?,?,?,?)').bind(id, 'radar', trigger, 'running', startedAt).run();
  try {
    const summary = await fn();
    await env.CRM_DB.prepare("UPDATE growth_runs SET status='success',completed_at=?,summary_json=? WHERE id=?")
      .bind(new Date().toISOString(), JSON.stringify(summary).slice(0, 7000), id).run();
    return summary;
  } catch (error) {
    await env.CRM_DB.prepare("UPDATE growth_runs SET status='failed',completed_at=?,error_text=? WHERE id=?")
      .bind(new Date().toISOString(), String(error?.message || error).slice(0, 1000), id).run();
    throw error;
  }
}

function sourceUrlAllowed(value, candidates) {
  const url = validUrl(value);
  if (!url) return '';
  return candidates.some((x) => x.link === url) ? url : '';
}
function normalizeNewsLink(value) {
  const url = validUrl(value);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('bing.com') && parsed.pathname.includes('apiclick')) {
      return validUrl(parsed.searchParams.get('url')) || url;
    }
  } catch {}
  return url;
}
function validUrl(value) { try { const u = new URL(String(value || '').trim()); return ['http:','https:'].includes(u.protocol) ? u.toString().slice(0, 1200) : ''; } catch { return ''; } }
function tag(block, name) { const match = String(block).match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i')); return match ? match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '') : ''; }
function decodeXml(value) { return String(value || '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function stripHtml(value) { return String(value || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
function clean(value, max=500) { return String(value || '').replace(/\s+/g,' ').trim().slice(0,max); }
function clampScore(value) { return Math.max(0, Math.min(100, Math.round(Number(value || 0)))); }
function dateValue(value) { const t = Date.parse(String(value || '')); return Number.isFinite(t) ? t : 0; }
function inferPillar(text) { const t=String(text||'').toLowerCase(); if(t.includes('log'))return 'Logística e transportes'; if(t.includes('agro'))return 'Tecnologia para o agronegócio'; if(t.includes('e-commerce')||t.includes('varejo'))return 'E-commerce e operações digitais'; if(t.includes('ia')||t.includes('intelig'))return 'IA aplicada ao negócio'; if(t.includes('api')||t.includes('integra'))return 'Integrações e APIs'; if(t.includes('dados')||t.includes('bi'))return 'Dados, BI e painéis'; if(t.includes('autom'))return 'Automação de processos'; return 'Desenvolvimento de software sob medida'; }
