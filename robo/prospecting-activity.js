export async function handleProspectingActivity(request, env, cors = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/prospecting/')) return null;
  if (!authorizeAdmin(request, env)) return respond({ ok:false, error:'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok:false, error:'crm_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/prospecting/activity' && request.method === 'GET') {
    return getActivity(request, env, cors);
  }
  if (url.pathname === '/crm/prospecting/activity' && ['POST','PUT','PATCH'].includes(request.method)) {
    return upsertActivity(request, env, cors);
  }
  return null;
}

async function getActivity(request, env, cors) {
  const url = new URL(request.url);
  const days = clampInt(url.searchParams.get('days') || 7, 1, 90);
  const channel = normalizeChannel(url.searchParams.get('channel') || 'linkedin');
  const owner = clean(url.searchParams.get('owner') || '', 80).toLowerCase();
  const sinceDate = dateInSaoPaulo(Date.now() - (days - 1) * 86400000);

  const where = ['activity_date>=?', 'channel=?'];
  const binds = [sinceDate, channel];
  if (owner) { where.push('owner=? COLLATE NOCASE'); binds.push(owner); }

  const result = await env.CRM_DB.prepare(`SELECT id,activity_date,owner,channel,connections,interactions,first_messages,followups,content_posts,qualified_replies,meetings_booked,notes,created_at,updated_at
    FROM prospecting_daily_activity WHERE ${where.join(' AND ')} ORDER BY activity_date DESC,owner`).bind(...binds).all();

  const rows = (result.results || []).map(mapRow);
  const totals = rows.reduce((a, r) => {
    for (const key of ['connections','interactions','firstMessages','followups','contentPosts','qualifiedReplies','meetingsBooked']) a[key] += Number(r[key] || 0);
    return a;
  }, emptyTotals());

  const today = dateInSaoPaulo();
  const todayRows = rows.filter((r) => r.date === today);
  const todayTotals = todayRows.reduce((a, r) => {
    for (const key of ['connections','interactions','firstMessages','followups','contentPosts','qualifiedReplies','meetingsBooked']) a[key] += Number(r[key] || 0);
    return a;
  }, emptyTotals());

  return respond({
    ok:true,
    days,
    channel,
    owner:owner || null,
    today,
    rows,
    totals,
    todayTotals,
    dailyTargets:{connections:15,interactions:10,firstMessages:5,followups:5,contentPosts:1,meetingsBooked:1},
    weeklyTargets:{connections:75,interactions:50,firstMessages:25,followups:25,contentPosts:5,meetingsBooked:2},
    generatedAt:new Date().toISOString(),
  }, 200, cors);
}

async function upsertActivity(request, env, cors) {
  const body = await readJson(request);
  const date = validDate(body.date || body.activityDate) ? String(body.date || body.activityDate) : dateInSaoPaulo();
  const owner = clean(body.owner || 'admin', 80).toLowerCase();
  const channel = normalizeChannel(body.channel || 'linkedin');
  if (!/^[a-z0-9][a-z0-9._-]{1,59}$/.test(channel)) return respond({ok:false,error:'invalid_channel'},400,cors);
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(owner)) return respond({ok:false,error:'invalid_owner'},400,cors);

  const values = {
    connections: nonNegativeInt(body.connections),
    interactions: nonNegativeInt(body.interactions),
    firstMessages: nonNegativeInt(body.firstMessages ?? body.first_messages),
    followups: nonNegativeInt(body.followups),
    contentPosts: nonNegativeInt(body.contentPosts ?? body.content_posts),
    qualifiedReplies: nonNegativeInt(body.qualifiedReplies ?? body.qualified_replies),
    meetingsBooked: nonNegativeInt(body.meetingsBooked ?? body.meetings_booked),
  };
  if (Object.values(values).some((v) => v === null)) return respond({ok:false,error:'invalid_activity_value'},400,cors);

  const notes = clean(body.notes || '', 1200) || null;
  const now = new Date().toISOString();
  const existing = await env.CRM_DB.prepare(`SELECT id,created_at FROM prospecting_daily_activity
    WHERE activity_date=? AND owner=? COLLATE NOCASE AND channel=? LIMIT 1`).bind(date, owner, channel).first();
  const id = existing?.id || crypto.randomUUID();
  const createdAt = existing?.created_at || now;

  await env.CRM_DB.prepare(`INSERT INTO prospecting_daily_activity
    (id,activity_date,owner,channel,connections,interactions,first_messages,followups,content_posts,qualified_replies,meetings_booked,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(activity_date,owner,channel) DO UPDATE SET
      connections=excluded.connections,
      interactions=excluded.interactions,
      first_messages=excluded.first_messages,
      followups=excluded.followups,
      content_posts=excluded.content_posts,
      qualified_replies=excluded.qualified_replies,
      meetings_booked=excluded.meetings_booked,
      notes=excluded.notes,
      updated_at=excluded.updated_at`)
    .bind(id,date,owner,channel,values.connections,values.interactions,values.firstMessages,values.followups,values.contentPosts,values.qualifiedReplies,values.meetingsBooked,notes,createdAt,now).run();

  const row = await env.CRM_DB.prepare(`SELECT id,activity_date,owner,channel,connections,interactions,first_messages,followups,content_posts,qualified_replies,meetings_booked,notes,created_at,updated_at
    FROM prospecting_daily_activity WHERE activity_date=? AND owner=? COLLATE NOCASE AND channel=? LIMIT 1`).bind(date, owner, channel).first();
  return respond({ok:true,activity:mapRow(row)},200,cors);
}

function mapRow(row) {
  return {
    id:row.id,
    date:row.activity_date,
    owner:row.owner,
    channel:row.channel,
    connections:Number(row.connections||0),
    interactions:Number(row.interactions||0),
    firstMessages:Number(row.first_messages||0),
    followups:Number(row.followups||0),
    contentPosts:Number(row.content_posts||0),
    qualifiedReplies:Number(row.qualified_replies||0),
    meetingsBooked:Number(row.meetings_booked||0),
    notes:row.notes||'',
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  };
}

function emptyTotals(){return{connections:0,interactions:0,firstMessages:0,followups:0,contentPosts:0,qualifiedReplies:0,meetingsBooked:0};}
function normalizeChannel(value){return String(value||'linkedin').trim().toLowerCase().replace(/\s+/g,'_').slice(0,60)||'linkedin';}
function nonNegativeInt(value){const n=Number(value??0);return Number.isInteger(n)&&n>=0&&n<=100000?n:null;}
function clampInt(value,min,max){const n=Math.floor(Number(value||min));return Math.min(Math.max(Number.isFinite(n)?n:min,min),max);}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}
function dateInSaoPaulo(ms=Date.now()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
  const map=Object.fromEntries(parts.map((p)=>[p.type,p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
async function readJson(request){try{return await request.json();}catch{return {};}}
function clean(value,max=500){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function authorizeAdmin(request,env){const expected=String(env.CRM_ADMIN_KEY||'');const provided=request.headers.get('x-crm-key')||String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');return safeEqual(provided,expected);}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function respond(data,status,cors){return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
