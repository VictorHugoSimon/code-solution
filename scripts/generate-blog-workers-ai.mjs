import fs from 'node:fs/promises';
import path from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
const model = process.env.WORKERS_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fast';
if (!accountId || !apiToken) throw new Error('Cloudflare credentials are required');

const topics = [
  {
    slug: 'como-automatizar-processos-ao-redor-do-erp-sem-trocar-o-sistema',
    title: 'Como automatizar processos ao redor do ERP sem trocar o sistema',
    category: 'Automação e Integrações',
    angle: 'Explique como identificar planilhas paralelas, dupla digitação, aprovações por e-mail ou WhatsApp, integrações frágeis e relatórios manuais. Mostre uma abordagem gradual: mapear processo, medir impacto, integrar, automatizar e monitorar.'
  },
  {
    slug: 'automacao-de-excecoes-na-logistica-como-reduzir-retrabalho',
    title: 'Automação de exceções na logística: como reduzir retrabalho operacional',
    category: 'Logística e Automação',
    angle: 'Mostre como atrasos, documentos faltantes, ocorrências, divergências e pedidos de status podem ser tratados com regras, alertas, workflow, integrações e painéis, sem prometer métricas não comprovadas.'
  },
  {
    slug: 'varejo-em-expansao-como-evitar-que-o-crescimento-aumente-o-retrabalho',
    title: 'Varejo em expansão: como evitar que o crescimento aumente o retrabalho',
    category: 'Varejo e Tecnologia',
    angle: 'Explique os efeitos de novas lojas, canais e CDs sobre integrações, abastecimento, indicadores, exceções e governança de dados. Traga um checklist de preparação tecnológica.'
  },
  {
    slug: 'portal-b2b-para-distribuidores-quando-faz-sentido-construir-sob-medida',
    title: 'Portal B2B para distribuidores: quando faz sentido construir sob medida',
    category: 'Sistemas Sob Medida',
    angle: 'Discuta catálogo complexo, regras comerciais, disponibilidade, múltiplos CDs, pedidos, atendimento e integrações. Compare configuração de plataforma pronta com desenvolvimento de camadas específicas.'
  },
  {
    slug: 'ia-na-operacao-como-sair-do-demo-e-gerar-valor-real',
    title: 'IA na operação: como sair do demo e gerar valor real',
    category: 'Inteligência Artificial',
    angle: 'Mostre que IA precisa de processo, dados, regras, fallback e critérios de sucesso. Dê exemplos genéricos em atendimento, classificação, análise e apoio à decisão, sem inventar cases ou ROI.'
  },
  {
    slug: 'quando-uma-planilha-virou-sistema-e-o-que-fazer-depois',
    title: 'Quando uma planilha virou sistema — e o que fazer depois',
    category: 'Transformação Digital',
    angle: 'Explique sinais de risco: versões conflitantes, dependência de uma pessoa, ausência de auditoria, fórmulas frágeis, reprocessamento e integrações manuais. Oriente quando automatizar e quando criar um sistema pequeno.'
  },
  {
    slug: 'discovery-de-software-como-reduzir-risco-antes-de-desenvolver',
    title: 'Discovery de software: como reduzir risco antes de desenvolver',
    category: 'Produto e Software',
    angle: 'Explique AS-IS, TO-BE, impacto, integrações, riscos, critérios de aceite, backlog e arquitetura. Mostre por que uma discovery curta pode evitar escopo baseado apenas em telas.'
  },
  {
    slug: 'bi-operacional-como-transformar-dados-dispersos-em-decisao',
    title: 'BI operacional: como transformar dados dispersos em decisão',
    category: 'Dados e BI',
    angle: 'Aborde integração de fontes, qualidade, definição de KPIs, alertas e responsabilidade sobre ação. Diferencie dashboard decorativo de indicador operacional acionável.'
  }
];

const dir = path.resolve('content/blog');
await fs.mkdir(dir, { recursive: true });
const existing = new Set((await fs.readdir(dir)).filter((x) => x.endsWith('.json')).map((x) => x.replace(/\.json$/,'')));
let topic = topics.find((t) => !existing.has(t.slug));
if (!topic) {
  const stamp = new Date().toISOString().slice(0,10);
  topic = { ...topics[Math.floor(Date.now() / 86400000) % topics.length], slug: `${topics[Math.floor(Date.now() / 86400000) % topics.length].slug}-${stamp}` };
}

const pt = await generatePt(topic);
const en = await translateLocale(pt, 'English', 'en');
const es = await translateLocale(pt, 'Spanish', 'es');
for (const locale of [pt, en, es]) locale.slug = topic.slug;

const output = {
  pt, en, es,
  social: {
    linkedin: { caption: `${pt.title}\n\n${pt.excerpt}\n\nLeia o artigo completo no blog da Code Solution.`, hashtags: '#CodeSolution #Automacao #Software #TransformacaoDigital' },
    instagram: { caption: `${pt.title}\n\n${pt.excerpt}`, hashtags: '#CodeSolution #Tecnologia #Automacao' },
    facebook: { caption: `${pt.title}\n\n${pt.excerpt}`, hashtags: '#CodeSolution #Tecnologia' }
  },
  slug: topic.slug,
  cat: pt.category,
  kw: pt.keywords?.[0] || pt.category,
  date: new Date().toISOString()
};

validateLocale(pt, 'pt');
validateLocale(en, 'en');
validateLocale(es, 'es');
await fs.writeFile(path.join(dir, `${topic.slug}.json`), JSON.stringify(output, null, 2) + '\n');
console.log(`Generated ${topic.slug}`);

async function generatePt(t) {
  const prompt = `Você é estrategista de conteúdo B2B da Code Solution, empresa brasileira de software sob medida, integrações, automação, IA e dados.\n\nCrie um artigo em português do Brasil sobre: ${t.title}.\nDireção editorial: ${t.angle}\n\nRegras obrigatórias:\n- Público: gestores de tecnologia, operações, comercial e diretoria de empresas B2B.\n- Tom consultivo, concreto e profissional; evite hype e frases vazias.\n- Não invente estatísticas, ROI, clientes, certificações, pesquisas ou números.\n- Não faça alegações jurídicas ou médicas.\n- O texto deve ajudar o leitor a diagnosticar o próprio processo.\n- Inclua uma resposta direta no primeiro parágrafo, 4 a 6 seções H2, uma lista prática/checklist e FAQ com 3 perguntas H3.\n- Termine com CTA discreto para https://www.codesolution.com.br/diagnostico/ .\n- body deve ser HTML simples usando apenas p,h2,h3,ul,ol,li,strong,a.\n- Retorne APENAS JSON válido, sem markdown, exatamente com os campos: title, excerpt, category, readingTime, metaDescription, keywords (array de 4 a 6 strings), body.\n- Todos os valores string, inclusive body, devem estar entre aspas JSON duplas, nunca crases/backticks.\n- category: ${t.category}.\n- title com até 80 caracteres; excerpt 120–200 caracteres; metaDescription 130–160 caracteres; body com pelo menos 3500 caracteres.`;
  return callAi(prompt, 5000);
}

async function translateLocale(source, language, locale) {
  const prompt = `Translate the following Brazilian Portuguese B2B article into ${language}. Preserve the meaning, HTML tags, factual caution, CTA URL and structure. Do not add statistics, claims, clients or facts. Adapt idioms naturally. Return ONLY valid JSON with exactly: title, excerpt, category, readingTime, metaDescription, keywords (array), body. Keep body as simple HTML. Every string value, including body, must use valid JSON double quotes, never backticks. Locale code: ${locale}.\n\nSOURCE JSON:\n${JSON.stringify(source)}`;
  return callAi(prompt, 5000);
}

async function callAi(prompt, maxTokens) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  let last = '';
  for (let attempt=1; attempt<=3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'system', content: 'Return strict JSON only. All string values must use JSON double quotes, never backticks.' }, { role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.2 })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Workers AI HTTP ${response.status}: ${text.slice(0,300)}`);
    const envelope = JSON.parse(text);
    last = envelope?.result?.response ?? envelope?.result?.output_text ?? '';
    try { return parseJson(last); } catch (error) {
      if (attempt === 3) throw new Error(`Workers AI invalid JSON after retries: ${String(error.message).slice(0,200)}`);
    }
  }
  throw new Error(`Workers AI returned no usable response: ${String(last).slice(0,200)}`);
}

function parseJson(text) {
  const clean = String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('JSON object not found');
  const candidate = escapeControlCharsInJsonStrings(clean.slice(first,last+1));
  try {
    return JSON.parse(candidate);
  } catch (firstError) {
    const repaired = escapeControlCharsInJsonStrings(repairTemplateLiteralStrings(candidate)).replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(repaired);
    } catch (secondError) {
      throw new Error(`${firstError.message}; repaired parse: ${secondError.message}`);
    }
  }
}

function escapeControlCharsInJsonStrings(input) {
  let out = '';
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (!inDouble) {
      out += ch;
      if (ch === '"') inDouble = true;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inDouble = false;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (ch === '\b') out += '\\b';
      else if (ch === '\f') out += '\\f';
      else out += `\\u${code.toString(16).padStart(4, '0')}`;
      continue;
    }
    out += ch;
  }
  return out;
}

function repairTemplateLiteralStrings(input) {
  let out = '';
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inDouble) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      continue;
    }
    if (ch !== '`') {
      out += ch;
      continue;
    }
    let value = '';
    let closed = false;
    for (i = i + 1; i < input.length; i++) {
      const inner = input[i];
      if (inner === '\\' && input[i + 1] === '`') {
        value += '`';
        i++;
        continue;
      }
      if (inner === '`') {
        closed = true;
        break;
      }
      value += inner;
    }
    if (!closed) throw new Error('Unterminated template-literal string');
    out += JSON.stringify(value);
  }
  return out;
}

function validateLocale(x, locale) {
  for (const k of ['title','excerpt','category','readingTime','metaDescription','body']) if (!String(x?.[k]||'').trim()) throw new Error(`${locale}: missing ${k}`);
  if (!Array.isArray(x.keywords) || x.keywords.length < 3) throw new Error(`${locale}: invalid keywords`);
  if (String(x.body).length < 2500) throw new Error(`${locale}: body too short`);
  if (!/<h2>/i.test(x.body) || !/<h3>/i.test(x.body)) throw new Error(`${locale}: headings missing`);
  if (/\bCodi\b/i.test(JSON.stringify(x))) throw new Error(`${locale}: legacy branding found`);
}
