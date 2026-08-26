const form=document.querySelector('#lead-form');
const statusEl=document.querySelector('#form-status');
const qs=new URLSearchParams(location.search);
const attribution={utm_source:qs.get('utm_source')||'',utm_medium:qs.get('utm_medium')||'',utm_campaign:qs.get('utm_campaign')||'',utm_content:qs.get('utm_content')||'',utm_term:qs.get('utm_term')||'',referrer:document.referrer||'',landing_page:location.pathname};

function setStatus(message,ok=true){if(!statusEl)return;statusEl.textContent=message;statusEl.style.color=ok?'#1E3B28':'#8b2d2d'}

if(form){form.addEventListener('submit',async(e)=>{e.preventDefault();setStatus('Enviando...');const fd=new FormData(form);const payload={name:String(fd.get('name')||'').trim(),phone:String(fd.get('phone')||'').trim(),email:String(fd.get('email')||'').trim(),interest:String(fd.get('interest')||'').trim(),message:String(fd.get('message')||'').trim(),consent:fd.get('consent')==='on',...attribution};try{const res=await fetch('/api/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Falha ao enviar');form.reset();setStatus('Recebemos seu contato. A Ser Vital retornará pelo WhatsApp ou e-mail informado.');window.dispatchEvent(new CustomEvent('serVitalLead',{detail:{id:data.id,interest:payload.interest}}));}catch(err){console.error(err);setStatus('Não conseguimos enviar agora. Você pode falar diretamente pelo WhatsApp.',false)}})}
