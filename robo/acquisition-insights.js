export async function handleAcquisitionInsights(request, env, cors = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/acquisition/')) return null;
  if (!authorizeAdmin(request, env)) return respond({ ok:false, error:'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok:false, error:'crm_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/acquisition/goals' && request.method === 'GET') {
    return getGoals(request, env, cors);
  }
  if (/^\/crm\/acquisition\/goal\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') {
    return patchGoal(request, env, cors);
  }
  if (url.pathname === '/crm/acquisition/landing-pages' && request.method === 'GET') {
    return landingPages(request, env, cors);
  }
  return null;
}

async function getGoals(request, env, cors) {
  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get('days') || 7);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [goalResult, eventResult, linkResult] = await Promise.all([
    env.CRM_DB.prepare(`SELECT channel,weekly_sessions_goal,weekly_leads_goal,weekly_wins_goal,active,updated_at
      FROM acquisition_channel_goals ORDER BY active DESC,channel`).all(),
    env.CRM_DB.prepare(`SELECT session_id,source FROM acquisition_events WHERE created_at>=? LIMIT 30000`).bind(since).all(),
    env.CRM_DB.prepare(`SELECT l.session_id,l.source,leads.status FROM lead_acquisition_links l
      JOIN leads ON leads.id=l.lead_id WHERE l.linked_at>=? LIMIT 10000`).bind(since).all(),
  ]);

  const observed = new Map();
  const touch = (channel) => {
    const key = normalizeChannel(channel);
    if (!observed.has(key)) observed.set(key,{sessions:new Set(),leads:0,wins:0});
    return observed.get(key);
  };
  for (const event of eventResult.results || []) touch(event.source).sessions.add(event.session_id);
  for (const link of linkResult.results || []) {
    const bucket = touch(link.source);
    bucket.sessions.add(link.session_id);
    bucket.leads++;
    if (link.status === 'ganho') bucket.wins++;
  }

  const goals = (goalResult.results || []).map((row) => {
    const actual = observed.get(normalizeChannel(row.channel)) || {sessions:new Set(),leads:0,wins:0};
    const configured = Number(row.weekly_sessions_goal||0) > 0 || Number(row.weekly_leads_goal||0) > 0 || Number(row.weekly_wins_goal||0) > 0;
    return {
      channel: row.channel,
      active: Boolean(row.active),
      configured,
      goals: {
        sessions: Number(row.weekly_sessions_goal||0),
        leads: Number(row.weekly_leads_goal||0),
        wins: Number(row.weekly_wins_goal||0),
      },
      actual: { sessions: actual.sessions.size, leads: actual.leads, wins: actual.wins },
      progress: {
        sessions: progress(actual.sessions.size, Number(row.weekly_sessions_goal||0)),
        leads: progress(actual.leads, Number(row.weekly_leads_goal||0)),
        wins: progress(actual.wins, Number(row.weekly_wins_goal||0)),
      },
      updatedAt: row.updated_at,
    };
  });

  return respond({ok:true,days,since,goals,generatedAt:new Date().toISOString()},200,cors);
}

async function patchGoal(request, env, cors) {
  const channel = normalizeChannel(decodeURIComponent(new URL(request.url).pathname.split('/').pop()));
  if (!/^[a-z0-9][a-z0-9._-]{1,59}$/.test(channel)) return respond({ok:false,error:'invalid_channel'},400,cors);
  const body = await readJson(request);
  const sessions = nonNegativeInt(body.sessionsGoal ?? body.weeklySessionsGoal);
  const leads = nonNegativeInt(body.leadsGoal ?? body.weeklyLeadsGoal);
  const wins = nonNegativeInt(body.winsGoal ?? body.weeklyWinsGoal);
  if ([sessions,leads,wins].some((x)=>x===null)) return respond({ok:false,error:'invalid_goal'},400,cors);
  const active = body.active === undefined ? 1 : (body.active ? 1 : 0);
  const now = new Date().toISOString();
  await env.CRM_DB.prepare(`INSERT INTO acquisition_channel_goals
    (channel,weekly_sessions_goal,weekly_leads_goal,weekly_wins_goal,active,updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(channel) DO UPDATE SET weekly_sessions_goal=excluded.weekly_sessions_goal,
      weekly_leads_goal=excluded.weekly_leads_goal,weekly_wins_goal=excluded.weekly_wins_goal,
      active=excluded.active,updated_at=excluded.updated_at`)
    .bind(channel,sessions,leads,wins,active,now).run();
  const row = await env.CRM_DB.prepare(`SELECT channel,weekly_sessions_goal,weekly_leads_goal,weekly_wins_goal,active,updated_at
    FROM acquisition_channel_goals WHERE channel=?`).bind(channel).first();
  return respond({ok:true,goal:{channel:row.channel,active:Boolean(row.active),goals:{sessions:Number(row.weekly_sessions_goal||0),leads:Number(row.weekly_leads_goal||0),wins:Number(row.weekly_wins_goal||0)},updatedAt:row.updated_at}},200,cors);
}

async function landingPages(request, env, cors) {
  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get('days') || 30);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [eventResult, linkResult] = await Promise.all([
    env.CRM_DB.prepare(`SELECT session_id,page_path,created_at FROM acquisition_events
      WHERE created_at>=? AND page_path IS NOT NULL ORDER BY created_at ASC LIMIT 30000`).bind(since).all(),
    env.CRM_DB.prepare(`SELECT l.session_id,l.landing_page,leads.status,leads.temperature
      FROM lead_acquisition_links l JOIN leads ON leads.id=l.lead_id
      WHERE l.linked_at>=? LIMIT 10000`).bind(since).all(),
  ]);

  const firstPage = new Map();
  for (const event of eventResult.results || []) {
    const path = safePath(event.page_path);
    if (path && !firstPage.has(event.session_id)) firstPage.set(event.session_id,path);
  }
  const pages = new Map();
  const touch = (path) => {
    const key = safePath(path) || '/';
    if (!pages.has(key)) pages.set(key,{sessions:new Set(),leads:0,wins:0,hot:0});
    return pages.get(key);
  };
  for (const [sessionId,path] of firstPage.entries()) touch(path).sessions.add(sessionId);
  for (const link of linkResult.results || []) {
    const path = safePath(link.landing_page) || firstPage.get(link.session_id) || '/';
    const bucket = touch(path);
    bucket.sessions.add(link.session_id);
    bucket.leads++;
    if (link.status === 'ganho') bucket.wins++;
    if (link.temperature === 'quente') bucket.hot++;
  }

  const landingPages = [...pages.entries()].map(([page,v])=>({
    page,
    sessions:v.sessions.size,
    leads:v.leads,
    hotLeads:v.hot,
    wins:v.wins,
    visitToLeadPercent:percent(v.leads,v.sessions.size),
    leadToWinPercent:percent(v.wins,v.leads),
  })).sort((a,b)=>b.leads-a.leads || b.sessions-a.sessions).slice(0,100);

  return respond({ok:true,days,since,landingPages,generatedAt:new Date().toISOString()},200,cors);
}

function normalizeChannel(value){return String(value||'direto').trim().toLowerCase().replace(/\s+/g,'_').slice(0,60)||'direto';}
function nonNegativeInt(value){const n=Number(value??0);return Number.isInteger(n)&&n>=0&&n<=1000000?n:null;}
function clampDays(value){return Math.min(Math.max(Number(value||30),1),365);}
function progress(actual,goal){return goal>0?Math.round((actual/goal)*1000)/10:null;}
function percent(a,b){return b?Math.round((a/b)*1000)/10:0;}
function safePath(value){const s=String(value||'').trim();if(!s.startsWith('/')||s.startsWith('//'))return null;return s.split('?')[0].split('#')[0].slice(0,300);}
async function readJson(request){try{return await request.json();}catch{return {};}}
function authorizeAdmin(request,env){const expected=String(env.CRM_ADMIN_KEY||'');const provided=request.headers.get('x-crm-key')||String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');return safeEqual(provided,expected);}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function respond(data,status,cors){return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
