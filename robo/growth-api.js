const ACCOUNT_STATUSES = new Set(['novo','qualificar','abordar','em_conversa','convertido','descartado']);
const CONTENT_STATUSES = new Set(['pronto','publicado','descartado']);

export async function handleGrowthApi(request, env, cors = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/growth')) return null;
  if (!authorizeAdmin(request, env)) return respond({ ok: false, error: 'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok: false, error: 'growth_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/growth/summary' && request.method === 'GET') return summary(env, cors);
  if (url.pathname === '/crm/growth/accounts' && request.method === 'GET') return accounts(request, env, cors);
  if (/^\/crm\/growth\/account\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return patchAccount(request, env, cors);
  if (url.pathname === '/crm/growth/content' && request.method === 'GET') return content(request, env, cors);
  if (/^\/crm\/growth\/content\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return patchContent(request, env, cors);
  if (url.pathname === '/crm/growth/topics' && request.method === 'GET') return topics(request, env, cors);
  if (url.pathname === '/crm/growth/runs' && request.method === 'GET') return runs(request, env, cors);
  return respond({ ok: false, error: 'not_found' }, 404, cors);
}

async function summary(env, cors) {
  const [prospects, highIntent, ready, published, topicsOpen, runsResult, metricsResult] = await Promise.all([
    scalar(env, "SELECT COUNT(*) c FROM growth_accounts WHERE status NOT IN ('convertido','descartado')"),
    scalar(env, "SELECT COUNT(*) c FROM growth_accounts WHERE score>=75 AND status NOT IN ('convertido','descartado')"),
    scalar(env, "SELECT COUNT(*) c FROM growth_content WHERE status='pronto'"),
    scalar(env, "SELECT COUNT(*) c FROM growth_content WHERE status='publicado'"),
    scalar(env, "SELECT COUNT(*) c FROM growth_topics WHERE status='aberto'"),
    env.CRM_DB.prepare("SELECT agent,status,trigger_type,started_at,completed_at,error_text,summary_json FROM growth_runs ORDER BY started_at DESC LIMIT 12").all(),
    env.CRM_DB.prepare("SELECT * FROM growth_metrics ORDER BY metric_date DESC LIMIT 14").all(),
  ]);
  return respond({
    ok: true,
    prospects,
    highIntent,
    contentReady: ready,
    contentPublished: published,
    topicsOpen,
    recentRuns: (runsResult.results || []).map(mapRun),
    metrics: metricsResult.results || [],
    generatedAt: new Date().toISOString(),
  }, 200, cors);
}

async function accounts(request, env, cors) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get('limit'), 100);
  const status = clean(url.searchParams.get('status'), 30);
  const minScore = Math.max(0, Math.min(100, Number(url.searchParams.get('minScore') || 0)));
  let sql = `SELECT id,company,domain,segment,location,source_url,source_title,signal_type,signal_text,score,priority,status,outreach_angle,suggested_message,discovered_at,updated_at
    FROM growth_accounts WHERE score >= ?`;
  const bindings = [minScore];
  if (status) { sql += ' AND status = ?'; bindings.push(status); }
  sql += ' ORDER BY score DESC, updated_at DESC LIMIT ?'; bindings.push(limit);
  const result = await env.CRM_DB.prepare(sql).bind(...bindings).all();
  return respond({ ok: true, accounts: (result.results || []).map(mapAccount) }, 200, cors);
}

async function patchAccount(request, env, cors) {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const body = await readJson(request);
  const current = await env.CRM_DB.prepare('SELECT * FROM growth_accounts WHERE id=?').bind(id).first();
  if (!current) return respond({ ok: false, error: 'not_found' }, 404, cors);
  const status = body.status === undefined ? current.status : clean(body.status, 30);
  if (!ACCOUNT_STATUSES.has(status)) return respond({ ok: false, error: 'invalid_status' }, 400, cors);
  const message = body.suggestedMessage === undefined ? current.suggested_message : cleanMultiline(body.suggestedMessage, 1800);
  const angle = body.outreachAngle === undefined ? current.outreach_angle : clean(body.outreachAngle, 900);
  const now = new Date().toISOString();
  await env.CRM_DB.prepare('UPDATE growth_accounts SET status=?,suggested_message=?,outreach_angle=?,updated_at=? WHERE id=?')
    .bind(status, message || null, angle || null, now, id).run();
  const updated = await env.CRM_DB.prepare('SELECT * FROM growth_accounts WHERE id=?').bind(id).first();
  return respond({ ok: true, account: mapAccount(updated) }, 200, cors);
}

async function content(request, env, cors) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get('limit'), 100);
  const status = clean(url.searchParams.get('status'), 30);
  const channel = clean(url.searchParams.get('channel'), 60);
  let sql = `SELECT id,kind,channel,title,body,cta,source_article_slug,source_topic_id,status,scheduled_for,published_at,created_at,updated_at,metadata_json
    FROM growth_content WHERE 1=1`;
  const bindings = [];
  if (status) { sql += ' AND status=?'; bindings.push(status); }
  if (channel) { sql += ' AND channel=?'; bindings.push(channel); }
  sql += ' ORDER BY CASE status WHEN \'pronto\' THEN 0 ELSE 1 END, created_at DESC LIMIT ?'; bindings.push(limit);
  const result = await env.CRM_DB.prepare(sql).bind(...bindings).all();
  return respond({ ok: true, content: (result.results || []).map(mapContent) }, 200, cors);
}

async function patchContent(request, env, cors) {
  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop());
  const body = await readJson(request);
  const current = await env.CRM_DB.prepare('SELECT * FROM growth_content WHERE id=?').bind(id).first();
  if (!current) return respond({ ok: false, error: 'not_found' }, 404, cors);
  const status = body.status === undefined ? current.status : clean(body.status, 30);
  if (!CONTENT_STATUSES.has(status)) return respond({ ok: false, error: 'invalid_status' }, 400, cors);
  const now = new Date().toISOString();
  const publishedAt = status === 'publicado' ? (current.published_at || now) : (status === 'pronto' ? null : current.published_at);
  await env.CRM_DB.prepare('UPDATE growth_content SET status=?,published_at=?,updated_at=? WHERE id=?').bind(status, publishedAt, now, id).run();
  const updated = await env.CRM_DB.prepare('SELECT * FROM growth_content WHERE id=?').bind(id).first();
  return respond({ ok: true, content: mapContent(updated) }, 200, cors);
}

async function topics(request, env, cors) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get('limit'), 100);
  const status = clean(url.searchParams.get('status'), 30);
  let sql = 'SELECT id,topic,pillar,keyword,intent,score,rationale,source_url,status,created_at,updated_at FROM growth_topics';
  const bindings = [];
  if (status) { sql += ' WHERE status=?'; bindings.push(status); }
  sql += ' ORDER BY score DESC, created_at DESC LIMIT ?'; bindings.push(limit);
  const result = await env.CRM_DB.prepare(sql).bind(...bindings).all();
  return respond({ ok: true, topics: (result.results || []).map((x) => ({ id:x.id,topic:x.topic,pillar:x.pillar,keyword:x.keyword,intent:x.intent,score:x.score,rationale:x.rationale,sourceUrl:x.source_url,status:x.status,createdAt:x.created_at,updatedAt:x.updated_at })) }, 200, cors);
}

async function runs(request, env, cors) {
  const limit = clampLimit(new URL(request.url).searchParams.get('limit'), 100);
  const result = await env.CRM_DB.prepare('SELECT agent,status,trigger_type,started_at,completed_at,error_text,summary_json FROM growth_runs ORDER BY started_at DESC LIMIT ?').bind(limit).all();
  return respond({ ok: true, runs: (result.results || []).map(mapRun) }, 200, cors);
}

function mapAccount(x) {
  return { id:x.id,company:x.company,domain:x.domain,segment:x.segment,location:x.location,sourceUrl:x.source_url,sourceTitle:x.source_title,signalType:x.signal_type,signalText:x.signal_text,score:x.score,priority:x.priority,status:x.status,outreachAngle:x.outreach_angle,suggestedMessage:x.suggested_message,discoveredAt:x.discovered_at,updatedAt:x.updated_at };
}
function mapContent(x) {
  let metadata = {};
  try { metadata = JSON.parse(x.metadata_json || '{}'); } catch {}
  return { id:x.id,kind:x.kind,channel:x.channel,title:x.title,body:x.body,cta:x.cta,sourceArticleSlug:x.source_article_slug,sourceTopicId:x.source_topic_id,status:x.status,scheduledFor:x.scheduled_for,publishedAt:x.published_at,createdAt:x.created_at,updatedAt:x.updated_at,metadata };
}
function mapRun(x) {
  let summary = null;
  try { summary = JSON.parse(x.summary_json || 'null'); } catch {}
  return { agent:x.agent,status:x.status,trigger:x.trigger_type,startedAt:x.started_at,completedAt:x.completed_at,error:x.error_text,summary };
}
async function scalar(env, sql) { const row = await env.CRM_DB.prepare(sql).first(); return Number(row?.c || 0); }
function authorizeAdmin(request, env) {
  const expected = env.CRM_ADMIN_KEY || '';
  if (!expected) return false;
  const provided = request.headers.get('x-crm-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return safeEqual(provided, expected);
}
function safeEqual(a, b) { if (!a || !b || a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }
function clampLimit(value, fallback=100) { return Math.min(Math.max(Number(value || fallback), 1), 250); }
function clean(value, max=500) { return String(value || '').replace(/\s+/g,' ').trim().slice(0,max); }
function cleanMultiline(value, max=2000) { return String(value || '').replace(/\r/g,'').trim().slice(0,max); }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function respond(data,status,cors){ return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}}); }
