const LINKEDIN_STATUSES = new Set(['pesquisar','conectar','conectado','interagir','mensagem_1','followup_1','followup_2','qualificado','convertido','pausado','descartado']);
const TERMINAL_LINKEDIN = new Set(['convertido','pausado','descartado']);
const TOUCH_EVENTS = new Set(['conexao_enviada','conexao_aceita','comentario','mensagem_1','followup_1','followup_2','resposta','reuniao','conteudo_enviado']);

export async function handleProspectingActivity(request, env, cors = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/crm/prospecting/')) return null;
  if (!authorizeAdmin(request, env)) return respond({ ok:false, error:'unauthorized' }, 401, cors);
  if (!env.CRM_DB) return respond({ ok:false, error:'crm_db_not_configured' }, 503, cors);

  if (url.pathname === '/crm/prospecting/activity' && request.method === 'GET') return getActivity(request, env, cors);
  if (url.pathname === '/crm/prospecting/activity' && ['POST','PUT','PATCH'].includes(request.method)) return upsertActivity(request, env, cors);

  if (url.pathname === '/crm/prospecting/linkedin/summary' && request.method === 'GET') return linkedinSummary(request, env, cors);
  if (url.pathname === '/crm/prospecting/linkedin/prospects' && request.method === 'GET') return listLinkedinProspects(request, env, cors);
  if (url.pathname === '/crm/prospecting/linkedin/prospects' && request.method === 'POST') return createLinkedinProspect(request, env, cors);
  if (/^\/crm\/prospecting\/linkedin\/prospect\/[^/]+$/.test(url.pathname) && request.method === 'GET') return getLinkedinProspect(request, env, cors);
  if (/^\/crm\/prospecting\/linkedin\/prospect\/[^/]+$/.test(url.pathname) && request.method === 'PATCH') return patchLinkedinProspect(request, env, cors);
  if (/^\/crm\/prospecting\/linkedin\/prospect\/[^/]+\/event$/.test(url.pathname) && request.method === 'POST') return addLinkedinEvent(request, env, cors);
  if (/^\/crm\/prospecting\/linkedin\/prospect\/[^/]+\/convert$/.test(url.pathname) && request.method === 'POST') return convertLinkedinProspect(request, env, cors);
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
  const rows = (result.results || []).map(mapActivityRow);
  const totals = rows.reduce(addActivityTotals, emptyTotals());
  const today = dateInSaoPaulo();
  const todayTotals = rows.filter((r) => r.date === today).reduce(addActivityTotals, emptyTotals());
  return respond({ok:true,days,channel,owner:owner||null,today,rows,totals,todayTotals,dailyTargets:{connections:15,interactions:10,firstMessages:5,followups:5,contentPosts:1,meetingsBooked:1},weeklyTargets:{connections:75,interactions:50,firstMessages:25,followups:25,contentPosts:5,meetingsBooked:2},generatedAt:new Date().toISOString()},200,cors);
}

async function upsertActivity(request, env, cors) {
  const body = await readJson(request);
  const date = validDate(body.date || body.activityDate) ? String(body.date || body.activityDate) : dateInSaoPaulo();
  const owner = clean(body.owner || 'admin', 80).toLowerCase();
  const channel = normalizeChannel(body.channel || 'linkedin');
  if (!/^[a-z0-9][a-z0-9._-]{1,59}$/.test(channel)) return respond({ok:false,error:'invalid_channel'},400,cors);
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(owner)) return respond({ok:false,error:'invalid_owner'},400,cors);
  const values = {connections:nonNegativeInt(body.connections),interactions:nonNegativeInt(body.interactions),firstMessages:nonNegativeInt(body.firstMessages??body.first_messages),followups:nonNegativeInt(body.followups),contentPosts:nonNegativeInt(body.contentPosts??body.content_posts),qualifiedReplies:nonNegativeInt(body.qualifiedReplies??body.qualified_replies),meetingsBooked:nonNegativeInt(body.meetingsBooked??body.meetings_booked)};
  if (Object.values(values).some((v) => v === null)) return respond({ok:false,error:'invalid_activity_value'},400,cors);
  const notes = cleanMultiline(body.notes || '', 1200) || null;
  const now = new Date().toISOString();
  const existing = await env.CRM_DB.prepare(`SELECT id,created_at FROM prospecting_daily_activity WHERE activity_date=? AND owner=? COLLATE NOCASE AND channel=? LIMIT 1`).bind(date,owner,channel).first();
  const id = existing?.id || crypto.randomUUID(); const createdAt = existing?.created_at || now;
  await env.CRM_DB.prepare(`INSERT INTO prospecting_daily_activity (id,activity_date,owner,channel,connections,interactions,first_messages,followups,content_posts,qualified_replies,meetings_booked,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(activity_date,owner,channel) DO UPDATE SET connections=excluded.connections,interactions=excluded.interactions,first_messages=excluded.first_messages,followups=excluded.followups,content_posts=excluded.content_posts,qualified_replies=excluded.qualified_replies,meetings_booked=excluded.meetings_booked,notes=excluded.notes,updated_at=excluded.updated_at`)
    .bind(id,date,owner,channel,values.connections,values.interactions,values.firstMessages,values.followups,values.contentPosts,values.qualifiedReplies,values.meetingsBooked,notes,createdAt,now).run();
  const row = await env.CRM_DB.prepare(`SELECT id,activity_date,owner,channel,connections,interactions,first_messages,followups,content_posts,qualified_replies,meetings_booked,notes,created_at,updated_at FROM prospecting_daily_activity WHERE activity_date=? AND owner=? COLLATE NOCASE AND channel=? LIMIT 1`).bind(date,owner,channel).first();
  return respond({ok:true,activity:mapActivityRow(row)},200,cors);
}

async function linkedinSummary(request, env, cors) {
  const url = new URL(request.url); const owner = clean(url.searchParams.get('owner') || 'ercilaine',80).toLowerCase(); const today = dateInSaoPaulo(); const nowIso = new Date().toISOString();
  const [prospectsResult,activityResult] = await Promise.all([
    env.CRM_DB.prepare('SELECT status,score,next_action_due,crm_lead_id FROM linkedin_prospects WHERE owner=? COLLATE NOCASE').bind(owner).all(),
    env.CRM_DB.prepare("SELECT connections,interactions,first_messages,followups,content_posts,qualified_replies,meetings_booked FROM prospecting_daily_activity WHERE activity_date=? AND owner=? COLLATE NOCASE AND channel='linkedin' LIMIT 1").bind(today,owner).first(),
  ]);
  const prospects=prospectsResult.results||[], funnel={}; for(const row of prospects) funnel[row.status]=(funnel[row.status]||0)+1;
  const active=prospects.filter((x)=>!TERMINAL_LINKEDIN.has(x.status));
  const dueToday=active.filter((x)=>x.next_action_due&&String(x.next_action_due).slice(0,10)===today).length;
  const overdue=active.filter((x)=>x.next_action_due&&normalizeDue(x.next_action_due)<nowIso).length;
  return respond({ok:true,owner,today,total:prospects.length,active:active.length,hot:active.filter((x)=>Number(x.score)>=70).length,dueToday,overdue,qualified:prospects.filter((x)=>['qualificado','convertido'].includes(x.status)).length,converted:prospects.filter((x)=>x.status==='convertido'||x.crm_lead_id).length,funnel,todayActivity:activityResult?mapActivityNumbers(activityResult):emptyTotals(),dailyTargets:{connections:15,interactions:10,firstMessages:5,followups:5,contentPosts:1,meetingsBooked:1},generatedAt:new Date().toISOString()},200,cors);
}

async function listLinkedinProspects(request, env, cors) {
  const url=new URL(request.url), owner=clean(url.searchParams.get('owner')||'',80).toLowerCase(), status=clean(url.searchParams.get('status')||'',30), q=clean(url.searchParams.get('q')||'',120).toLowerCase(), limit=clampInt(url.searchParams.get('limit')||250,1,500);
  const where=['1=1'], binds=[]; if(owner){where.push('owner=? COLLATE NOCASE');binds.push(owner);} if(status){where.push('status=?');binds.push(status);} if(q){where.push('(lower(name) LIKE ? OR lower(company) LIKE ? OR lower(title) LIKE ? OR lower(segment) LIKE ?)');const like=`%${q}%`;binds.push(like,like,like,like);}
  const now=new Date().toISOString(); binds.push(now,limit);
  const result=await env.CRM_DB.prepare(`SELECT * FROM linkedin_prospects WHERE ${where.join(' AND ')} ORDER BY CASE WHEN next_action_due IS NOT NULL AND next_action_due < ? THEN 0 ELSE 1 END, score DESC, updated_at DESC LIMIT ?`).bind(...binds).all();
  return respond({ok:true,prospects:(result.results||[]).map(mapLinkedinProspect)},200,cors);
}

async function getLinkedinProspect(request,env,cors){const id=idFromPath(request,'prospect');const prospect=await env.CRM_DB.prepare('SELECT * FROM linkedin_prospects WHERE id=?').bind(id).first();if(!prospect)return respond({ok:false,error:'not_found'},404,cors);const events=await env.CRM_DB.prepare('SELECT id,event_type,note,actor,metadata_json,created_at FROM linkedin_prospect_events WHERE prospect_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();return respond({ok:true,prospect:mapLinkedinProspect(prospect),events:(events.results||[]).map(mapLinkedinEvent)},200,cors);}

async function createLinkedinProspect(request,env,cors){const body=await readJson(request);const name=clean(body.name,160),company=clean(body.company,180),linkedinUrl=safeLinkedinUrl(body.linkedinUrl||body.linkedin_url);if(!name||!company||!linkedinUrl)return respond({ok:false,error:'validation_error'},400,cors);const status=clean(body.status||'pesquisar',30);if(!LINKEDIN_STATUSES.has(status))return respond({ok:false,error:'invalid_status'},400,cors);const existing=await env.CRM_DB.prepare('SELECT id FROM linkedin_prospects WHERE linkedin_url=?').bind(linkedinUrl).first();if(existing)return respond({ok:false,error:'duplicate_profile',id:existing.id},409,cors);const now=new Date().toISOString(),id=crypto.randomUUID(),owner=clean(body.owner||'ercilaine',80).toLowerCase();await env.CRM_DB.prepare(`INSERT INTO linkedin_prospects (id,name,title,company,segment,location,linkedin_url,company_url,owner,status,score,pain,context,notes,next_action,next_action_due,touch_count,last_touch_at,crm_lead_id,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,name,nullable(body.title,160),company,nullable(body.segment,120),nullable(body.location,160),linkedinUrl,safeHttpUrl(body.companyUrl||body.company_url),owner,status,scoreValue(body.score),nullableMultiline(body.pain,1200),nullableMultiline(body.context,1600),nullableMultiline(body.notes,2400),nullable(body.nextAction||body.next_action,500),nullableDateTime(body.nextActionDue||body.next_action_due),0,null,null,'linkedin',now,now).run();await insertLinkedinEvent(env,id,'prospect_criado','Prospect incluído na carteira LinkedIn.',owner,{});const created=await env.CRM_DB.prepare('SELECT * FROM linkedin_prospects WHERE id=?').bind(id).first();return respond({ok:true,prospect:mapLinkedinProspect(created)},201,cors);}

async function patchLinkedinProspect(request,env,cors){const id=idFromPath(request,'prospect'),current=await env.CRM_DB.prepare('SELECT * FROM linkedin_prospects WHERE id=?').bind(id).first();if(!current)return respond({ok:false,error:'not_found'},404,cors);const body=await readJson(request),status=body.status===undefined?current.status:clean(body.status,30);if(!LINKEDIN_STATUSES.has(status))return respond({ok:false,error:'invalid_status'},400,cors);const linkedinUrl=body.linkedinUrl===undefined&&body.linkedin_url===undefined?current.linkedin_url:safeLinkedinUrl(body.linkedinUrl||body.linkedin_url);if(!linkedinUrl)return respond({ok:false,error:'invalid_linkedin_url'},400,cors);const now=new Date().toISOString();const f={name:body.name===undefined?current.name:clean(body.name,160),title:body.title===undefined?current.title:nullable(body.title,160),company:body.company===undefined?current.company:clean(body.company,180),segment:body.segment===undefined?current.segment:nullable(body.segment,120),location:body.location===undefined?current.location:nullable(body.location,160),linkedinUrl,companyUrl:body.companyUrl===undefined&&body.company_url===undefined?current.company_url:safeHttpUrl(body.companyUrl||body.company_url),owner:body.owner===undefined?current.owner:clean(body.owner,80).toLowerCase(),status,score:body.score===undefined?Number(current.score||0):scoreValue(body.score),pain:body.pain===undefined?current.pain:nullableMultiline(body.pain,1200),context:body.context===undefined?current.context:nullableMultiline(body.context,1600),notes:body.notes===undefined?current.notes:nullableMultiline(body.notes,2400),nextAction:body.nextAction===undefined&&body.next_action===undefined?current.next_action:nullable(body.nextAction||body.next_action,500),nextActionDue:body.nextActionDue===undefined&&body.next_action_due===undefined?current.next_action_due:nullableDateTime(body.nextActionDue||body.next_action_due)};if(!f.name||!f.company||!f.owner)return respond({ok:false,error:'validation_error'},400,cors);await env.CRM_DB.prepare('UPDATE linkedin_prospects SET name=?,title=?,company=?,segment=?,location=?,linkedin_url=?,company_url=?,owner=?,status=?,score=?,pain=?,context=?,notes=?,next_action=?,next_action_due=?,updated_at=? WHERE id=?').bind(f.name,f.title,f.company,f.segment,f.location,f.linkedinUrl,f.companyUrl,f.owner,f.status,f.score,f.pain,f.context,f.notes,f.nextAction,f.nextActionDue,now,id).run();if(status!==current.status)await insertLinkedinEvent(env,id,'status_alterado',`${current.status} → ${status}`,f.owner,{from:current.status,to:status});const updated=await env.CRM_DB.prepare('SELECT * FROM linkedin_prospects WHERE id=?').bind(id).first();return respond({ok:true,prospect:mapLinkedinProspect(updated)},200,cors);}

async function addLinkedinEvent(request,env,cors){const id=idFromPath(request,'prospect'),prospect=await env.CRM_DB.prepare('SELECT * FROM linkedin_prospects WHERE id=?').bind(id).first();if(!prospect)return respond({ok:false,error:'not_found'},404,cors);const body=await readJson(request),eventType=clean(body.eventType||body.event_type,60).toLowerCase();if(!eventType)return respond({ok:false,error:'event_type_required'},400,cors);const actor=clean(body.actor||prospect.owner||'ercilaine',80).toLowerCase(),note=nullableMultiline(body.note,1800);await insertLinkedinEvent(env,id,eventType,note,actor,body.metadata||{});const now=new Date().toISOString();if(TOUCH_EVENTS.has(eventType)){const candidate=clean(body.status,30),nextStatus=LINKEDIN_STATUSES.has(candidate)?candidate:prospect.status;await env.CRM_DB.prepare('UPDATE linkedin_prospects SET touch_count=touch_count+1,last_touch_at=?,status=?,updated_at=? WHERE id=?').bind(now,nextStatus,now,id).run();}const updated=await env.CRM_DB.prepare('SELECT * FROM linkedin_prospects WHERE id=?').bind(id).first();return respond({ok:true,prospect:mapLinkedinProspect(updated)},201,cors);}

async function convertLinkedinProspect(request,env,cors){const id=idFromPath(request,'prospect'),prospect=await env.CRM_DB.prepare('SELECT * FROM linkedin_prospects WHERE id=?').bind(id).first();if(!prospect)return respond({ok:false,error:'not_found'},404,cors);if(prospect.crm_lead_id)return respond({ok:true,alreadyConverted:true,leadId:prospect.crm_lead_id},200,cors);const body=await readJson(request),whatsapp=clean(body.whatsapp,60),need=cleanMultiline(body.need||prospect.pain||'',1800);if(!whatsapp||!need)return respond({ok:false,error:'validation_error',fields:{whatsapp:!whatsapp?'required':undefined,need:!need?'required':undefined}},400,cors);const leadId=crypto.randomUUID(),now=new Date().toISOString(),score=Math.max(70,Number(prospect.score||0)),owner=clean(body.owner||prospect.owner||'ercilaine',80).toLowerCase();await env.CRM_DB.prepare(`INSERT INTO leads (id,name,whatsapp,email,company,segment,need,source,campaign,medium,content,landing_page,status,score,temperature,owner,next_action,next_action_due,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(leadId,prospect.name,whatsapp,nullable(body.email,220),prospect.company,prospect.segment,need,'linkedin','linkedin_organico','organic','prospeccao_ercilaine',prospect.linkedin_url,'qualificado',score,score>=80?'quente':'morno',owner,clean(body.nextAction||'Agendar discovery',500),nullableDateTime(body.nextActionDue),`Origem: prospecção orgânica LinkedIn. Perfil: ${prospect.linkedin_url}${prospect.notes?`\n${prospect.notes}`:''}`.slice(0,3000),now,now).run();await env.CRM_DB.prepare('UPDATE linkedin_prospects SET status=?,crm_lead_id=?,next_action=?,next_action_due=?,updated_at=? WHERE id=?').bind('convertido',leadId,'Acompanhar no CRM',null,now,id).run();await insertLinkedinEvent(env,id,'convertido_crm',`Lead criado no CRM: ${leadId}`,owner,{leadId});return respond({ok:true,leadId,crmUrl:`/painel/crm/?lead=${encodeURIComponent(leadId)}`},201,cors);}

async function insertLinkedinEvent(env,prospectId,eventType,note,actor,metadata){await env.CRM_DB.prepare('INSERT INTO linkedin_prospect_events (id,prospect_id,event_type,note,actor,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),prospectId,clean(eventType,60),nullableMultiline(note,1800),clean(actor||'sistema',80),JSON.stringify(sanitizeMetadata(metadata)).slice(0,3000),new Date().toISOString()).run();}
function mapActivityRow(row){return{id:row.id,date:row.activity_date,owner:row.owner,channel:row.channel,...mapActivityNumbers(row),notes:row.notes||'',createdAt:row.created_at,updatedAt:row.updated_at};}
function mapActivityNumbers(row){return{connections:Number(row?.connections||0),interactions:Number(row?.interactions||0),firstMessages:Number(row?.first_messages||0),followups:Number(row?.followups||0),contentPosts:Number(row?.content_posts||0),qualifiedReplies:Number(row?.qualified_replies||0),meetingsBooked:Number(row?.meetings_booked||0)};}
function addActivityTotals(a,r){for(const key of ['connections','interactions','firstMessages','followups','contentPosts','qualifiedReplies','meetingsBooked'])a[key]+=Number(r[key]||0);return a;}
function mapLinkedinProspect(x){return{id:x.id,name:x.name,title:x.title||'',company:x.company,segment:x.segment||'',location:x.location||'',linkedinUrl:x.linkedin_url,companyUrl:x.company_url||'',owner:x.owner,status:x.status,score:Number(x.score||0),pain:x.pain||'',context:x.context||'',notes:x.notes||'',nextAction:x.next_action||'',nextActionDue:x.next_action_due||'',touchCount:Number(x.touch_count||0),lastTouchAt:x.last_touch_at||'',crmLeadId:x.crm_lead_id||'',source:x.source||'linkedin',createdAt:x.created_at,updatedAt:x.updated_at};}
function mapLinkedinEvent(x){let metadata={};try{metadata=JSON.parse(x.metadata_json||'{}')}catch{}return{id:x.id,eventType:x.event_type,note:x.note||'',actor:x.actor||'',metadata,createdAt:x.created_at};}
function emptyTotals(){return{connections:0,interactions:0,firstMessages:0,followups:0,contentPosts:0,qualifiedReplies:0,meetingsBooked:0};}
function normalizeChannel(value){return String(value||'linkedin').trim().toLowerCase().replace(/\s+/g,'_').slice(0,60)||'linkedin';}
function nonNegativeInt(value){const n=Number(value??0);return Number.isInteger(n)&&n>=0&&n<=100000?n:null;}
function scoreValue(value){const n=Math.round(Number(value||0));return Math.min(100,Math.max(0,Number.isFinite(n)?n:0));}
function clampInt(value,min,max){const n=Math.floor(Number(value||min));return Math.min(Math.max(Number.isFinite(n)?n:min,min),max);}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}
function dateInSaoPaulo(ms=Date.now()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));const map=Object.fromEntries(parts.map((p)=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;}
function normalizeDue(value){const text=String(value||'');if(!text)return'';return text.length<=10?`${text}T23:59:59-03:00`:text;}
function idFromPath(request,marker){const parts=new URL(request.url).pathname.split('/').filter(Boolean),i=parts.indexOf(marker);return i>=0?decodeURIComponent(parts[i+1]||''):'';}
function safeLinkedinUrl(value){const url=safeHttpUrl(value);if(!url)return null;try{const u=new URL(url);return /(^|\.)linkedin\.com$/i.test(u.hostname)?u.toString():null;}catch{return null;}}
function safeHttpUrl(value){const text=clean(value,1000);if(!text)return null;try{const u=new URL(text);return['http:','https:'].includes(u.protocol)?u.toString():null;}catch{return null;}}
function nullable(value,max=500){const x=clean(value,max);return x||null;}
function nullableMultiline(value,max=2000){const x=cleanMultiline(value,max);return x||null;}
function nullableDateTime(value){const x=clean(value,80);if(!x)return null;const d=new Date(x.length<=10?`${x}T23:59:59-03:00`:x);return Number.isNaN(d.getTime())?null:x;}
function sanitizeMetadata(input){if(!input||typeof input!=='object'||Array.isArray(input))return{};const out={};for(const [k,v] of Object.entries(input).slice(0,20))out[clean(k,80)]=clean(v,300);return out;}
async function readJson(request){try{return await request.json();}catch{return {};}}
function clean(value,max=500){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function cleanMultiline(value,max=2000){return String(value??'').replace(/[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').replace(/\r/g,'').trim().slice(0,max);}
function authorizeAdmin(request,env){const expected=String(env.CRM_ADMIN_KEY||'');const provided=request.headers.get('x-crm-key')||String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');return safeEqual(provided,expected);}
function safeEqual(a,b){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function respond(data,status,cors){return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
