const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const id=()=>crypto.randomUUID();

export async function onRequestPost({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  let body;try{body=await request.json()}catch{return json({error:'JSON inválido.'},400)}
  const name=clean(body.name,100),phone=clean(body.phone,30),email=clean(body.email,120),interest=clean(body.interest,120),message=clean(body.message,1000);
  if(!name||!phone||!interest||body.consent!==true)return json({error:'Preencha nome, WhatsApp, interesse e consentimento.'},400);
  const leadId=id();const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO leads (id,created_at,name,phone,email,interest,message,consent,consent_at,utm_source,utm_medium,utm_campaign,utm_content,utm_term,referrer,landing_page,stage,last_contact_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(leadId,now,name,phone,email,interest,message,1,now,clean(body.utm_source,120),clean(body.utm_medium,120),clean(body.utm_campaign,160),clean(body.utm_content,160),clean(body.utm_term,160),clean(body.referrer,500),clean(body.landing_page,250),'Novo Lead',now).run();
  await env.DB.prepare(`INSERT INTO events (id,created_at,lead_id,event_type,source,payload) VALUES (?,?,?,?,?,?)`)
    .bind(id(),now,leadId,'lead_created','website',JSON.stringify({interest,utm_source:clean(body.utm_source,120),utm_campaign:clean(body.utm_campaign,160)})).run();
  return json({ok:true,id:leadId},201);
}

export async function onRequestGet({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  const token=request.headers.get('X-Admin-Token')||'';
  if(!env.ADMIN_TOKEN||token!==env.ADMIN_TOKEN)return json({error:'Não autorizado.'},401);
  const url=new URL(request.url);const stage=clean(url.searchParams.get('stage'),80);const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||100),1),500);
  let stmt=stage?env.DB.prepare(`SELECT * FROM leads WHERE stage=? ORDER BY created_at DESC LIMIT ?`).bind(stage,limit):env.DB.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT ?`).bind(limit);
  const {results}=await stmt.all();
  return json({ok:true,results});
}

export async function onRequestPatch({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  const token=request.headers.get('X-Admin-Token')||'';
  if(!env.ADMIN_TOKEN||token!==env.ADMIN_TOKEN)return json({error:'Não autorizado.'},401);
  let body;try{body=await request.json()}catch{return json({error:'JSON inválido.'},400)}
  const leadId=clean(body.id,80);if(!leadId)return json({error:'ID obrigatório.'},400);
  const stage=clean(body.stage,80)||'Novo Lead',nextAction=clean(body.next_action,250),notes=clean(body.notes,1500),scheduledAt=clean(body.scheduled_at,80);
  await env.DB.prepare(`UPDATE leads SET stage=?,next_action=?,notes=?,scheduled_at=?,paid=?,attended=?,recurring=?,last_contact_at=? WHERE id=?`)
    .bind(stage,nextAction,notes,scheduledAt,body.paid?1:0,body.attended?1:0,body.recurring?1:0,new Date().toISOString(),leadId).run();
  return json({ok:true});
}
