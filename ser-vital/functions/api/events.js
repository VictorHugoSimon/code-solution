const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(v,max=500)=>String(v??'').trim().slice(0,max);

export async function onRequestPost({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  let body;try{body=await request.json()}catch{return json({error:'JSON inválido.'},400)}
  const eventType=clean(body.event_type,80),source=clean(body.source,80)||'website',leadId=clean(body.lead_id,80)||null;
  if(!eventType)return json({error:'event_type obrigatório.'},400);
  const allowed=new Set(['page_view','cta_click','service_view','blog_view','agenda_view','whatsapp_click','form_start']);
  if(!allowed.has(eventType))return json({error:'Evento não permitido.'},400);
  const meta=body.meta&&typeof body.meta==='object'?body.meta:{};
  const safeMeta={path:clean(meta.path,250),referrer:clean(meta.referrer,500),utm_source:clean(meta.utm_source,120),utm_medium:clean(meta.utm_medium,120),utm_campaign:clean(meta.utm_campaign,160),label:clean(meta.label,200)};
  await env.DB.prepare(`INSERT INTO events (id,created_at,lead_id,event_type,source,payload) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),new Date().toISOString(),leadId,eventType,source,JSON.stringify(safeMeta)).run();
  return json({ok:true},201);
}
