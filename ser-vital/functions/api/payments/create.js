const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const SERVICE_CATALOG={
  'Reiki':{name:'Reiki online',description:'Sessão online Ser Vital — 45 a 60 minutos',value:127},
  'Radiestesia Radiônica':{name:'Radiestesia Radiônica',description:'Atendimento online Ser Vital — 45 a 60 minutos',value:197},
  'Meditação':{name:'Meditação individual',description:'Sessão guiada online Ser Vital — 45 a 60 minutos',value:97},
  'Jornada Equilíbrio':{name:'Jornada Equilíbrio',description:'Jornada Ser Vital com 4 encontros',value:497}
};

export async function onRequestPost({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  if(!env.ASAAS_API_KEY)return json({error:'payment_provider_not_configured',provider:'asaas'},503);
  let body;try{body=await request.json()}catch{return json({error:'JSON inválido.'},400)}
  const leadId=clean(body.lead_id,80);if(!leadId)return json({error:'lead_id obrigatório.'},400);
  const lead=await env.DB.prepare(`SELECT * FROM leads WHERE id=? LIMIT 1`).bind(leadId).first();
  if(!lead)return json({error:'Lead não encontrado.'},404);
  if(!lead.scheduled_at)return json({error:'Agendamento obrigatório antes do pagamento.'},409);
  const item=SERVICE_CATALOG[lead.interest];
  if(!item)return json({error:'Serviço sem preço configurado para checkout.'},409);

  const existing=await env.DB.prepare(`SELECT * FROM payments WHERE lead_id=? AND provider='asaas' AND status IN ('CREATED','PENDING','ACTIVE') ORDER BY created_at DESC LIMIT 1`).bind(leadId).first();
  if(existing?.checkout_url)return json({ok:true,reused:true,payment_id:existing.id,checkout_url:existing.checkout_url});

  const paymentId=crypto.randomUUID();
  const externalReference=`sv-${paymentId}`;
  const origin=new URL(request.url).origin;
  const base=(env.ASAAS_BASE_URL||'https://api-sandbox.asaas.com/v3').replace(/\/$/,'');
  const payload={
    billingTypes:['PIX','CREDIT_CARD'],
    chargeTypes:['DETACHED'],
    minutesToExpire:60,
    externalReference,
    callback:{successUrl:`${origin}/pagamento-sucesso.html`,cancelUrl:`${origin}/pagamento-cancelado.html`,expiredUrl:`${origin}/pagamento-expirado.html`},
    items:[{name:item.name,description:item.description,quantity:1,value:item.value}]
  };
  if(lead.name||lead.email||lead.phone){payload.customerData={name:lead.name||undefined,email:lead.email||undefined,phone:lead.phone||undefined}}

  const res=await fetch(`${base}/checkouts`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','access_token':env.ASAAS_API_KEY},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)return json({error:'Falha ao criar checkout Asaas.',provider_status:res.status,provider_response:data},502);
  const checkoutUrl=data.link||data.url||data.checkoutUrl||'';
  if(!data.id||!checkoutUrl)return json({error:'Resposta do provedor sem checkout utilizável.',provider_response:data},502);
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO payments (id,created_at,updated_at,lead_id,provider,external_id,external_reference,checkout_url,amount,currency,status,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(paymentId,now,now,leadId,'asaas',data.id,externalReference,checkoutUrl,item.value,'BRL',data.status||'CREATED',JSON.stringify(data)).run();
  await env.DB.prepare(`UPDATE leads SET stage='Aguardando pagamento',value_potential=?,next_action='Concluir pagamento',last_contact_at=? WHERE id=?`).bind(item.value,now,leadId).run();
  return json({ok:true,payment_id:paymentId,checkout_url:checkoutUrl,amount:item.value});
}
