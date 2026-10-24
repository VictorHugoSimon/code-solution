const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const authorized=(request,env)=>Boolean(env.ADMIN_TOKEN)&&request.headers.get('X-Admin-Token')===env.ADMIN_TOKEN;

export async function onRequestGet({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  if(!authorized(request,env))return json({error:'Não autorizado.'},401);
  const [totals,bySource,byStage,events]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) leads, SUM(CASE WHEN scheduled_at IS NOT NULL THEN 1 ELSE 0 END) scheduled, SUM(paid) paid, SUM(attended) attended, SUM(recurring) recurring, COALESCE(SUM(value_potential),0) value_potential FROM leads`).first(),
    env.DB.prepare(`SELECT COALESCE(NULLIF(utm_source,''),'Direto') source, COUNT(*) qty FROM leads GROUP BY COALESCE(NULLIF(utm_source,''),'Direto') ORDER BY qty DESC LIMIT 12`).all(),
    env.DB.prepare(`SELECT stage, COUNT(*) qty FROM leads GROUP BY stage ORDER BY qty DESC`).all(),
    env.DB.prepare(`SELECT event_type, COUNT(*) qty FROM events WHERE datetime(created_at) >= datetime('now','-30 day') GROUP BY event_type ORDER BY qty DESC`).all()
  ]);
  return json({ok:true,totals:totals||{},by_source:bySource.results||[],by_stage:byStage.results||[],events_30d:events.results||[]});
}
