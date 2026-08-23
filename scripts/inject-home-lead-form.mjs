import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'deploy', 'index.html');
let html = await fs.readFile(file, 'utf8');

html = html.replace(/\n?\s*<!-- HOME-LEAD-FORM:START -->[\s\S]*?<!-- HOME-LEAD-FORM:END -->\s*/g, '\n');

const block = `
<!-- HOME-LEAD-FORM:START -->
<section id="lead" class="cs-home-lead" style="position:relative;z-index:4;background:#0a0810;color:#ece9f2;padding:0 max(20px,calc((100% - 1120px)/2)) 82px;font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif">
  <div style="border:1px solid rgba(155,92,255,.32);border-radius:20px;background:linear-gradient(145deg,rgba(123,63,228,.18),rgba(18,16,26,.96));padding:clamp(22px,4vw,38px)">
    <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9b5cff">Fale com a Code Solution</div>
    <h2 style="font:700 clamp(28px,4vw,46px)/1.08 'Space Grotesk',system-ui,sans-serif;margin:10px 0 12px;max-width:20ch">Explique o problema. A gente organiza o próximo passo.</h2>
    <p style="color:#a7a4b6;font-size:17px;max-width:760px;margin:0 0 24px">Preencha o essencial. A solicitação entra direto no CRM da Code Solution com origem e campanha, sem depender de clique posterior no WhatsApp.</p>
    <form id="cs-home-lead-form" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:860px">
      <label style="display:grid;gap:6px"><span style="font-size:12px;color:#a7a4b6">Nome *</span><input name="name" autocomplete="name" required minlength="2" maxlength="120" style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#100d17;color:#fff"></label>
      <label style="display:grid;gap:6px"><span style="font-size:12px;color:#a7a4b6">WhatsApp *</span><input name="whatsapp" autocomplete="tel" inputmode="tel" required maxlength="40" placeholder="(18) 99999-9999" style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#100d17;color:#fff"></label>
      <label style="display:grid;gap:6px"><span style="font-size:12px;color:#a7a4b6">Empresa</span><input name="company" autocomplete="organization" maxlength="160" style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#100d17;color:#fff"></label>
      <label style="display:grid;gap:6px"><span style="font-size:12px;color:#a7a4b6">Segmento</span><input name="segment" maxlength="120" placeholder="Agro, logística, varejo..." style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#100d17;color:#fff"></label>
      <label style="grid-column:1/-1;display:grid;gap:6px"><span style="font-size:12px;color:#a7a4b6">O que você quer melhorar, automatizar ou construir? *</span><textarea name="need" required minlength="8" maxlength="1800" rows="4" style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#100d17;color:#fff;resize:vertical"></textarea></label>
      <label style="grid-column:1/-1;display:flex;gap:8px;align-items:flex-start;color:#a7a4b6;font-size:12px"><input name="consent" type="checkbox" required style="margin-top:3px"><span>Autorizo o uso dos dados acima para receber o atendimento solicitado, conforme a <a href="/privacidade/" style="color:#c9b0ff">Política de Privacidade</a>.</span></label>
      <div style="grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button type="submit" style="border:0;border-radius:11px;background:linear-gradient(135deg,#7B3FE4,#9b5cff);color:#fff;padding:13px 18px;font-weight:800;cursor:pointer">Registrar solicitação</button><a data-cs-whatsapp href="https://wa.me/5518996809954?text=Ol%C3%A1%2C%20quero%20conversar%20sobre%20um%20projeto." target="_blank" rel="noopener noreferrer" style="border:1px solid rgba(255,255,255,.12);border-radius:11px;color:#fff;padding:12px 16px;font-weight:800;text-decoration:none">Falar pelo WhatsApp</a><span id="cs-home-lead-result" aria-live="polite" style="font-size:13px;color:#a7a4b6"></span></div>
    </form>
  </div>
</section>
<script data-cs-home-lead-script>
(function(){
  var form=document.getElementById('cs-home-lead-form'); if(!form) return;
  var API='https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev';
  var result=document.getElementById('cs-home-lead-result');
  var sent=false;
  function track(name,params){try{if(window.gtag)window.gtag('event',name,params||{})}catch(e){}}
  function attribution(){try{var q=new URLSearchParams(location.search);return{source:q.get('utm_source')||'home_form',campaign:q.get('utm_campaign')||null,medium:q.get('utm_medium')||null,content:q.get('utm_content')||null,term:q.get('utm_term')||null,landingPage:location.pathname,referrer:document.referrer||null}}catch(e){return{source:'home_form',landingPage:'/'}}}
  form.addEventListener('submit',async function(ev){
    ev.preventDefault(); if(sent) return;
    var data=new FormData(form), name=String(data.get('name')||'').trim(), whatsapp=String(data.get('whatsapp')||'').trim(), need=String(data.get('need')||'').trim();
    if(name.length<2 || whatsapp.replace(/\D/g,'').length<10 || need.length<8 || !data.get('consent')){result.textContent='Revise os campos obrigatórios.';result.style.color='#ff8796';return;}
    var button=form.querySelector('button[type=submit]'); button.disabled=true; result.textContent='Registrando...';result.style.color='#a7a4b6';
    var payload=Object.assign({name:name,whatsapp:whatsapp,company:String(data.get('company')||'').trim()||undefined,segment:String(data.get('segment')||'').trim()||undefined,need:need,businessType:'empresa',consentAt:new Date().toISOString()},attribution());
    try{
      var response=await fetch(API+'/lead',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      var body=await response.json(); if(!response.ok) throw new Error(body.error||'lead_failed');
      sent=true; button.textContent='Solicitação registrada'; result.textContent='✓ ID '+body.leadId+' · '+(body.nextAction||'retorno do time');result.style.color='#6ee7aa';
      track('generate_lead',{method:'home_form',lead_score:body.score||0});
    }catch(e){button.disabled=false;result.textContent='Não consegui registrar agora. Use o WhatsApp ou tente novamente.';result.style.color='#ff8796';track('lead_error',{source:'home_form'});}
  });
  var wa=document.querySelector('[data-cs-whatsapp]'); if(wa)wa.addEventListener('click',function(){track('click_whatsapp',{source:'home_form'})});
  track('home_lead_form_view');
})();
</script>
<style data-cs-home-lead-mobile>@media(max-width:700px){#cs-home-lead-form{grid-template-columns:1fr!important}#cs-home-lead-form>label,#cs-home-lead-form>div{grid-column:1!important}}</style>
<!-- HOME-LEAD-FORM:END -->
`;

const anchor = '<!-- COMMERCIAL-EXTENSION:END -->';
if (html.includes(anchor)) html = html.replace(anchor, `${anchor}\n${block}`);
else html = html.replace('</body>', `${block}\n</body>`);

await fs.writeFile(file, html, 'utf8');
console.log('Home lead capture injected.');
