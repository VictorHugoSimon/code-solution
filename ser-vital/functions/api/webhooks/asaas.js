const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(v,max=500)=>String(v??'').trim().slice(0,max);

export async function onRequestPost({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  if(!env.ASAAS_WEBHOOK_TOKEN)return json({error:'Webhook não configurado.'},503);
  const token=request.headers.get('asaas-access-token')||'';
  if(token!==env.ASAAS_WEBHOOK_TOKEN)return json({error:'Não autorizado.'},401);
  let body;try{body=await request.json()}catch{return json({error:'JSON inválido.'},400)}
  const eventId=clean(body.id,120);const eventType=clean(body.event,120);const checkoutId=clean(body.checkout?.id,120);
  if(!eventId||!eventType)return json({error:'Evento Asaas incompleto.'},400);
  const duplicate=await env.DB.prepare(`SELECT id FROM webhook_events WHERE provider='asaas' AND external_id=? LIMIT 1`).bind(eventId).first();
  if(duplicate)return json({ok:true,duplicate:true});
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO webhook_events (id,created_at,provider,event_type,external_id,payload) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),now,'asaas',eventType,eventId,JSON.stringify(body)).run();

  if(checkoutId){
    const payment=await env.DB.prepare(`SELECT * FROM payments WHERE provider='asaas' AND external_id=? ORDER BY created_at DESC LIMIT 1`).bind(checkoutId).first();
    if(payment){
      let status=payment.status;let paid=0;let leadStage=null;
      if(eventType==='CHECKOUT_PAID'){status='PAID';paid=1;leadStage='Pago'}
      if(eventType==='CHECKOUT_CANCELED'){status='CANCELED';leadStage='Aguardando pagamento'}
      if(eventType==='CHECKOUT_EXPIRED'){status='EXPIRED';leadStage='Aguardando pagamento'}
      await env.DB.prepare(`UPDATE payments SET status=?,updated_at=?,payload=? WHERE id=?`).bind(status,now,JSON.stringify(body),payment.id).run();
      if(leadStage){
        await env.DB.prepare(`UPDATE leads SET paid=?,stage=?,next_action=?,last_contact_at=? WHERE id=?`).bind(paid,leadStage,paid?'Preparar atendimento':'Gerar novo checkout',now,payment.lead_id).run();
      }
    }
  }
  await env.DB.prepare(`UPDATE webhook_events SET processed_at=? WHERE provider='asaas' AND external_id=?`).bind(now,eventId).run();
  return json({ok:true});
}
