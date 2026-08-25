(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pc=v=>v===null||v===undefined?'—':`${Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
  let canWrite=false;

  function ensure(){
    if(document.getElementById('csAcquisition'))return;
    const kpis=document.querySelector('.kpis');if(!kpis)return;
    const section=document.createElement('section');section.id='csAcquisition';section.className='cs-acq';
    section.innerHTML=`
      <div class="cs-acq-head"><div><span>Funil de aquisição</span><h2>Visita → intenção → lead → ganho</h2><p>Medição anônima ligada ao CRM sem armazenar dados pessoais extras.</p></div><button id="csAcqRefresh" class="select">Atualizar</button></div>
      <div class="cs-acq-funnel" id="csAcqFunnel"></div>
      <div class="cs-acq-conv"><article><small>Visita → engajado</small><strong id="acqEngaged">0%</strong></article><article><small>Visita → lead</small><strong id="acqLead">0%</strong></article><article><small>Lead → ganho</small><strong id="acqWon">0%</strong></article></div>
      <div class="cs-acq-grid"><article><div class="cs-acq-title"><h3>Aquisição por origem</h3><span>sessões / leads / ganhos</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Origem</th><th>Sessões</th><th>Leads</th><th>Quentes</th><th>Ganhos</th><th>Visita→Lead</th><th>Lead→Ganho</th></tr></thead><tbody id="acqSources"></tbody></table></div></article><article><div class="cs-acq-title"><h3>Conteúdo influenciando leads</h3><span>landing de entrada</span></div><div id="acqContent" class="cs-acq-content"></div></article></div>
      <div class="cs-acq-grid cs-acq-secondary">
        <article><div class="cs-acq-title"><div><h3>Metas semanais por canal</h3><span id="goalMode">metas não configuradas não entram no cálculo</span></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Canal</th><th>Sessões</th><th>Meta</th><th>Leads</th><th>Meta</th><th>Ganhos</th><th>Meta</th><th>Progresso</th><th></th></tr></thead><tbody id="acqGoals"></tbody></table></div></article>
        <article><div class="cs-acq-title"><h3>Conversão por landing page</h3><span>primeira página da sessão</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Landing</th><th>Sessões</th><th>Leads</th><th>Quentes</th><th>Ganhos</th><th>Visita→Lead</th></tr></thead><tbody id="acqLandings"></tbody></table></div></article>
      </div>`;
    kpis.insertAdjacentElement('afterend',section);
    document.getElementById('csAcqRefresh').onclick=load;
    section.addEventListener('click',async e=>{
      const b=e.target.closest('[data-save-goal]');if(!b)return;
      if(!canWrite){flash('Seu perfil pode consultar metas, mas somente Admin/Comercial pode alterá-las.');return;}
      const tr=b.closest('tr'),channel=b.dataset.saveGoal;
      const fields=[...tr.querySelectorAll('input[data-goal]')];
      const body={};for(const f of fields)body[f.dataset.goal]=Math.max(0,Number(f.value||0));
      b.disabled=true;b.textContent='Salvando…';
      try{const r=await fetch(`/api/crm/acquisition/goal/${encodeURIComponent(channel)}`,{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha ao salvar meta');flash(`Meta de ${channel} atualizada.`);await load();}catch(err){flash(`Não foi possível salvar: ${err.message}`,true);}finally{b.disabled=false;b.textContent='Salvar';}
    });
  }

  function flash(message,error=false){
    let el=document.getElementById('acqFlash');
    if(!el){el=document.createElement('div');el.id='acqFlash';el.className='cs-acq-flash';document.querySelector('#csAcquisition .cs-acq-head')?.insertAdjacentElement('afterend',el);}
    el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4500);
  }
  function funnelRow(label,value,max){return `<div class="cs-acq-row"><span>${esc(label)}</span><div><i style="width:${max?Math.max(value?3:0,(value/max)*100):0}%"></i></div><b>${Number(value||0)}</b></div>`;}
  function progressBadge(values){const configured=values.filter(v=>v!==null);if(!configured.length)return '<span class="cs-muted">não configurada</span>';const avg=configured.reduce((a,b)=>a+b,0)/configured.length;const cls=avg>=100?'ok':avg>=70?'warn':'low';return `<span class="cs-progress ${cls}">${pc(avg)}</span>`;}
  function goalInput(channel,key,value){return canWrite?`<input class="cs-goal-input" type="number" min="0" step="1" data-goal="${key}" value="${Number(value||0)}" aria-label="Meta ${key} de ${esc(channel)}">`:`<span>${Number(value||0)||'—'}</span>`;}

  function render(d,g,l){
    ensure();const f=d.funnel||{},max=Math.max(1,f.visits||0);
    document.getElementById('csAcqFunnel').innerHTML=[['Visitas',f.visits],['Engajadas',f.engaged],['Início de formulário',f.formStarts],['Leads ligados',f.leads],['Ganhos',f.won]].map(x=>funnelRow(x[0],x[1],max)).join('');
    document.getElementById('acqEngaged').textContent=pc(d.conversion?.visitToEngaged);
    document.getElementById('acqLead').textContent=pc(d.conversion?.visitToLead);
    document.getElementById('acqWon').textContent=pc(d.conversion?.leadToWon);
    const sources=(d.bySource||[]).slice(0,20);
    document.getElementById('acqSources').innerHTML=sources.length?sources.map(x=>`<tr><td><span class="pill">${esc(x.name)}</span></td><td>${x.sessions}</td><td>${x.leads}</td><td>${x.hotLeads}</td><td>${x.wins}</td><td>${pc(x.visitToLeadPercent)}</td><td>${pc(x.leadToWinPercent)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">A telemetria começou agora; os dados aparecerão conforme houver novas sessões.</td></tr>';
    const content=(d.contentInfluence||[]).slice(0,12);
    document.getElementById('acqContent').innerHTML=content.length?content.map(x=>`<div><span><b>${esc(x.page)}</b><small>${x.leads} lead(s)</small></span><strong>${x.wins} ganho(s)</strong></div>`).join(''):'<div class="empty">Ainda não há leads ligados a conteúdos do blog.</div>';

    const goals=(g?.goals||[]).filter(x=>x.active).slice(0,30);
    document.getElementById('goalMode').textContent=canWrite?'edite metas e salve por canal':'visualização; alterações exigem perfil Admin/Comercial';
    document.getElementById('acqGoals').innerHTML=goals.length?goals.map(x=>`<tr><td><span class="pill">${esc(x.channel)}</span></td><td>${x.actual.sessions}</td><td>${goalInput(x.channel,'sessionsGoal',x.goals.sessions)}</td><td>${x.actual.leads}</td><td>${goalInput(x.channel,'leadsGoal',x.goals.leads)}</td><td>${x.actual.wins}</td><td>${goalInput(x.channel,'winsGoal',x.goals.wins)}</td><td>${progressBadge([x.progress.sessions,x.progress.leads,x.progress.wins])}</td><td>${canWrite?`<button class="cs-save" data-save-goal="${esc(x.channel)}">Salvar</button>`:''}</td></tr>`).join(''):'<tr><td colspan="9" class="empty">Nenhum canal configurado.</td></tr>';

    const landings=(l?.landingPages||[]).slice(0,30);
    document.getElementById('acqLandings').innerHTML=landings.length?landings.map(x=>`<tr><td><code>${esc(x.page)}</code></td><td>${x.sessions}</td><td>${x.leads}</td><td>${x.hotLeads}</td><td>${x.wins}</td><td>${pc(x.visitToLeadPercent)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">Ainda não há sessões suficientes para comparar landing pages.</td></tr>';
  }

  async function load(){
    ensure();const period=document.getElementById('period');const days=period?.value==='all'?365:Number(period?.value||30);
    try{
      const [sessionR,summaryR,goalsR,landingR]=await Promise.all([
        fetch('/api/auth/session',{credentials:'same-origin'}),
        fetch(`/api/crm/acquisition/summary?days=${days}`,{credentials:'same-origin'}),
        fetch(`/api/crm/acquisition/goals?days=7`,{credentials:'same-origin'}),
        fetch(`/api/crm/acquisition/landing-pages?days=${days}`,{credentials:'same-origin'}),
      ]);
      if([sessionR,summaryR,goalsR,landingR].some(r=>r.status===401)){location.href='/painel/login/?next=/painel/marketing/';return;}
      const session=await sessionR.json(),d=await summaryR.json(),g=await goalsR.json(),l=await landingR.json();
      if(!summaryR.ok)throw new Error(d.error||'Falha na aquisição');
      if(!goalsR.ok)throw new Error(g.error||'Falha nas metas');
      if(!landingR.ok)throw new Error(l.error||'Falha nas landing pages');
      canWrite=Array.isArray(session.permissions)&&session.permissions.includes('crm_write');
      render(d,g,l);
    }catch(e){const s=document.getElementById('csAcqFunnel');if(s)s.innerHTML=`<div class="empty">Aquisição indisponível: ${esc(e.message)}</div>`;}
  }

  const style=document.createElement('style');style.textContent=`.cs-acq{background:linear-gradient(145deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:15px;padding:16px;margin:-4px 0 18px}.cs-acq-head,.cs-acq-title{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.cs-acq-head span{color:var(--purple);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.cs-acq-head h2,.cs-acq-title h3{margin:0}.cs-acq-head p{margin:3px 0 0;color:var(--muted);font-size:12px}.cs-acq-funnel{display:grid;gap:7px;margin-top:14px}.cs-acq-row{display:grid;grid-template-columns:150px 1fr 50px;gap:9px;align-items:center}.cs-acq-row>div{height:10px;background:#181e2d;border-radius:99px;overflow:hidden}.cs-acq-row i{display:block;height:100%;background:linear-gradient(90deg,var(--purple),var(--blue));border-radius:99px}.cs-acq-conv{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.cs-acq-conv article,.cs-acq-grid article{background:#0b101c;border:1px solid var(--line);border-radius:12px;padding:13px}.cs-acq-conv small{color:var(--muted)}.cs-acq-conv strong{display:block;font-size:23px;margin-top:3px}.cs-acq-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:10px}.cs-acq-secondary{grid-template-columns:1.15fr .85fr;margin-top:10px}.cs-acq-title span{color:var(--muted);font-size:11px}.cs-acq-content{display:grid;gap:7px;margin-top:10px}.cs-acq-content>div{display:flex;justify-content:space-between;gap:8px;padding:9px;border:1px solid var(--line);border-radius:9px}.cs-acq-content span{display:grid}.cs-acq-content small{color:var(--muted)}.cs-acq-content strong{font-size:12px;color:var(--green)}.cs-goal-input{width:72px;border:1px solid var(--line);background:#111725;color:#fff;border-radius:8px;padding:7px}.cs-save{border:1px solid #385c78;background:#12324a;color:#dff3ff;border-radius:8px;padding:7px 9px;cursor:pointer}.cs-save:disabled{opacity:.55}.cs-progress{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:11px;font-weight:800}.cs-progress.ok{background:rgba(72,217,155,.12);color:var(--green)}.cs-progress.warn{background:rgba(255,201,102,.12);color:var(--amber)}.cs-progress.low{background:rgba(255,111,134,.1);color:#ff9cad}.cs-muted{color:var(--muted);font-size:11px}.cs-acq-flash{display:none;margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(72,217,155,.1);border:1px solid rgba(72,217,155,.3);color:#aaf2d1}.cs-acq-flash.show{display:block}.cs-acq-flash.error{background:rgba(255,111,134,.08);border-color:rgba(255,111,134,.3);color:#ffb7c3}@media(max-width:1000px){.cs-acq-grid,.cs-acq-secondary{grid-template-columns:1fr}}@media(max-width:650px){.cs-acq-row{grid-template-columns:105px 1fr 38px}.cs-acq-conv{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
  window.addEventListener('load',()=>setTimeout(load,850));
  document.addEventListener('change',e=>{if(e.target?.id==='period')setTimeout(load,50)});
})();
