const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function slotIso(date,hour){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}T${String(hour).padStart(2,'0')}:00:00-03:00`}

export async function onRequestGet({env}){
  const now=new Date();const candidates=[];
  for(let i=0;i<21&&candidates.length<30;i++){
    const d=new Date(now);d.setDate(now.getDate()+i);const wd=d.getDay();if(wd===0||wd===6)continue;
    for(const h of [20,21,22]){const iso=slotIso(d,h);if(new Date(iso)<=now)continue;candidates.push(iso)}
  }
  let booked=[];
  if(env.DB){const {results}=await env.DB.prepare(`SELECT scheduled_at FROM leads WHERE scheduled_at IS NOT NULL AND stage NOT IN ('Perdido/Inativo','Cancelado')`).all();booked=(results||[]).map(r=>r.scheduled_at)}
  return json({ok:true,timezone:'America/Sao_Paulo',duration_minutes:60,slots:candidates.filter(s=>!booked.includes(s)).slice(0,24)});
}

export async function onRequestPost({request,env}){
  if(!env.DB)return json({error:'Banco não configurado.'},503);
  let body;try{body=await request.json()}catch{return json({error:'JSON inválido.'},400)}
  const leadId=String(body.lead_id||'').trim();const scheduledAt=String(body.scheduled_at||'').trim();
  if(!leadId||!scheduledAt)return json({error:'lead_id e scheduled_at são obrigatórios.'},400);
  const dt=new Date(scheduledAt);const localHour=Number(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(dt));const localWeekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}).format(dt);
  if(![20,21,22].includes(localHour)||['Sat','Sun'].includes(localWeekday))return json({error:'Horário fora da agenda da Ser Vital.'},400);
  const exists=await env.DB.prepare(`SELECT id FROM leads WHERE scheduled_at=? AND stage NOT IN ('Perdido/Inativo','Cancelado') LIMIT 1`).bind(scheduledAt).first();
  if(exists)return json({error:'Este horário acabou de ser reservado. Escolha outro.'},409);
  await env.DB.prepare(`UPDATE leads SET scheduled_at=?,stage='Agendado',next_action='Pagamento/Confirmação',last_contact_at=? WHERE id=?`).bind(scheduledAt,new Date().toISOString(),leadId).run();
  return json({ok:true,scheduled_at:scheduledAt});
}
