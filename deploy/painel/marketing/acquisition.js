(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pc=v=>`${Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;

  function ensure(){
    if(document.getElementById('csAcquisition'))return;
    const kpis=document.querySelector('.kpis');if(!kpis)return;
    const section=document.createElement('section');section.id='csAcquisition';section.className='cs-acq';
    section.innerHTML=`
      <div class="cs-acq-head"><div><span>Funil de aquisição</span><h2>Visita → intenção → lead → ganho</h2><p>Medição anônima ligada ao CRM sem armazenar dados pessoais extras.</p></div><button id="csAcqRefresh" class="select">Atualizar</button></div>
      <div class="cs-acq-funnel" id="csAcqFunnel"></div>
      <div class="cs-acq-conv"><article><small>Visita → engajado</small><strong id="acqEngaged">0%</strong></article><article><small>Visita → lead</small><strong id="acqLead">0%</strong></article><article><small>Lead → ganho</small><strong id="acqWon">0%</strong></article></div>
      <div class="cs-acq-grid"><article><div class="cs-acq-title"><h3>Aquisição por origem</h3><span>sessões / leads / ganhos</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Origem</th><th>Sessões</th><th>Leads</th><th>Quentes</th><th>Ganhos</th><th>Visita→Lead</th><th>Lead→Ganho</th></tr></thead><tbody id="acqSources"></tbody></table></div></article><article><div class="cs-acq-title"><h3>Conteúdo influenciando leads</h3><span>landing de entrada</span></div><div id="acqContent" class="cs-acq-content"></div></article></div>`;
    kpis.insertAdjacentElement('afterend',section);
    document.getElementById('csAcqRefresh').onclick=load;
  }

  function funnelRow(label,value,max){return `<div class="cs-acq-row"><span>${esc(label)}</span><div><i style="width:${max?Math.max(value?3:0,(value/max)*100):0}%"></i></div><b>${Number(value||0)}</b></div>`;}
  function render(d){
    ensure();const f=d.funnel||{},max=Math.max(1,f.visits||0);
    document.getElementById('csAcqFunnel').innerHTML=[['Visitas',f.visits],['Engajadas',f.engaged],['Início de formulário',f.formStarts],['Leads ligados',f.leads],['Ganhos',f.won]].map(x=>funnelRow(x[0],x[1],max)).join('');
    document.getElementById('acqEngaged').textContent=pc(d.conversion?.visitToEngaged);
    document.getElementById('acqLead').textContent=pc(d.conversion?.visitToLead);
    document.getElementById('acqWon').textContent=pc(d.conversion?.leadToWon);
    const sources=(d.bySource||[]).slice(0,20);
    document.getElementById('acqSources').innerHTML=sources.length?sources.map(x=>`<tr><td><span class="pill">${esc(x.name)}</span></td><td>${x.sessions}</td><td>${x.leads}</td><td>${x.hotLeads}</td><td>${x.wins}</td><td>${pc(x.visitToLeadPercent)}</td><td>${pc(x.leadToWinPercent)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">A telemetria começou agora; os dados aparecerão conforme houver novas sessões.</td></tr>';
    const content=(d.contentInfluence||[]).slice(0,12);
    document.getElementById('acqContent').innerHTML=content.length?content.map(x=>`<div><span><b>${esc(x.page)}</b><small>${x.leads} lead(s)</small></span><strong>${x.wins} ganho(s)</strong></div>`).join(''):'<div class="empty">Ainda não há leads ligados a conteúdos do blog.</div>';
  }

  async function load(){
    ensure();const period=document.getElementById('period');const days=period?.value==='all'?365:Number(period?.value||30);
    try{const r=await fetch(`/api/crm/acquisition/summary?days=${days}`,{credentials:'same-origin'});if(r.status===401){location.href='/painel/login/?next=/painel/marketing/';return;}const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha na aquisição');render(d);}catch(e){const s=document.getElementById('csAcqFunnel');if(s)s.innerHTML=`<div class="empty">Aquisição indisponível: ${esc(e.message)}</div>`;}
  }

  const style=document.createElement('style');style.textContent=`.cs-acq{background:linear-gradient(145deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:15px;padding:16px;margin:-4px 0 18px}.cs-acq-head,.cs-acq-title{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.cs-acq-head span{color:var(--purple);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.cs-acq-head h2,.cs-acq-title h3{margin:0}.cs-acq-head p{margin:3px 0 0;color:var(--muted);font-size:12px}.cs-acq-funnel{display:grid;gap:7px;margin-top:14px}.cs-acq-row{display:grid;grid-template-columns:150px 1fr 50px;gap:9px;align-items:center}.cs-acq-row>div{height:10px;background:#181e2d;border-radius:99px;overflow:hidden}.cs-acq-row i{display:block;height:100%;background:linear-gradient(90deg,var(--purple),var(--blue));border-radius:99px}.cs-acq-conv{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.cs-acq-conv article,.cs-acq-grid article{background:#0b101c;border:1px solid var(--line);border-radius:12px;padding:13px}.cs-acq-conv small{color:var(--muted)}.cs-acq-conv strong{display:block;font-size:23px;margin-top:3px}.cs-acq-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:10px}.cs-acq-title span{color:var(--muted);font-size:11px}.cs-acq-content{display:grid;gap:7px;margin-top:10px}.cs-acq-content>div{display:flex;justify-content:space-between;gap:8px;padding:9px;border:1px solid var(--line);border-radius:9px}.cs-acq-content span{display:grid}.cs-acq-content small{color:var(--muted)}.cs-acq-content strong{font-size:12px;color:var(--green)}@media(max-width:1000px){.cs-acq-grid{grid-template-columns:1fr}}@media(max-width:650px){.cs-acq-row{grid-template-columns:105px 1fr 38px}.cs-acq-conv{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
  window.addEventListener('load',()=>setTimeout(load,850));
  document.addEventListener('change',e=>{if(e.target?.id==='period')setTimeout(load,50)});
})();
