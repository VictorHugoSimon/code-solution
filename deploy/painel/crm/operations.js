(() => {
  'use strict';
  const API='/api/crm/operations/summary';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hours=v=>v===null||v===undefined?'—':`${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}h`;
  const pct=v=>`${Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;

  function ensure(){
    if(document.getElementById('cs-ops'))return;
    const anchor=document.getElementById('crm-exec')||document.querySelector('.stats');
    if(!anchor)return;
    const section=document.createElement('section');
    section.id='cs-ops';section.className='cs-ops';
    section.innerHTML=`
      <div class="cs-ops-head"><div><span>Automação comercial</span><h2>SLA, alertas e velocidade</h2></div><button id="csOpsRefresh" class="btn">Atualizar</button></div>
      <div class="cs-ops-kpis">
        <article><small>Alertas críticos</small><strong id="opsCritical">0</strong><span>SLA/follow-up</span></article>
        <article><small>SLA primeiro contato</small><strong id="opsSla">—</strong><span>contatos em até 4h</span></article>
        <article><small>Tempo até 1º contato</small><strong id="opsFirst">—</strong><span>média medida</span></article>
        <article><small>Tempo até discovery</small><strong id="opsDiscovery">—</strong><span>média medida</span></article>
        <article><small>Tempo até proposta</small><strong id="opsProposal">—</strong><span>média medida</span></article>
      </div>
      <div class="cs-ops-grid"><article><div class="cs-ops-title"><h3>Alertas abertos</h3><a href="/painel/agenda/">Abrir agenda</a></div><div id="opsAlerts" class="cs-ops-list"></div></article><article><div class="cs-ops-title"><h3>Próximas tarefas</h3><span id="opsTasksCount">0 abertas</span></div><div id="opsTasks" class="cs-ops-list"></div></article></div>`;
    anchor.insertAdjacentElement('afterend',section);
    document.getElementById('csOpsRefresh').onclick=load;
  }

  function render(data){
    ensure();if(!document.getElementById('cs-ops'))return;
    const critical=(data.openAlerts||[]).filter(a=>a.severity==='critical').length;
    const velocity=data.velocity||{},sla=velocity.firstContactSla||{};
    document.getElementById('opsCritical').textContent=critical;
    document.getElementById('opsSla').textContent=sla.measured?pct(sla.compliancePercent):'—';
    document.getElementById('opsFirst').textContent=hours(velocity.avgHoursToFirstContact);
    document.getElementById('opsDiscovery').textContent=hours(velocity.avgHoursToDiscovery);
    document.getElementById('opsProposal').textContent=hours(velocity.avgHoursToProposal);
    const alerts=(data.openAlerts||[]).slice(0,8);
    document.getElementById('opsAlerts').innerHTML=alerts.length?alerts.map(a=>`<a class="cs-ops-row" href="/painel/agenda/"><b>${esc(a.title)}</b><span>${esc(a.owner||'Sem responsável')} · ${esc(a.alert_type)}</span></a>`).join(''):'<div class="cs-ops-empty">Nenhum alerta comercial aberto.</div>';
    const tasks=(data.openTasks||[]).slice(0,8);
    document.getElementById('opsTasksCount').textContent=`${(data.openTasks||[]).length} abertas`;
    document.getElementById('opsTasks').innerHTML=tasks.length?tasks.map(t=>`<a class="cs-ops-row" href="/painel/agenda/"><b>${esc(t.title)}</b><span>${esc(t.owner||'Sem responsável')}${t.due_at?' · '+esc(String(t.due_at).slice(0,10)):''}</span></a>`).join(''):'<div class="cs-ops-empty">Nenhuma tarefa comercial aberta.</div>';
  }

  async function load(){
    ensure();
    try{
      const r=await fetch(API,{credentials:'same-origin'});
      if(r.status===401){location.href='/painel/login/?next=/painel/crm/';return;}
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha ao carregar automação');render(d);
    }catch(e){const box=document.getElementById('opsAlerts');if(box)box.innerHTML=`<div class="cs-ops-empty">Automação indisponível: ${esc(e.message)}</div>`;}
  }

  const style=document.createElement('style');
  style.textContent=`.cs-ops{margin:0 18px 18px;border:1px solid var(--line);background:rgba(255,255,255,.018);border-radius:16px;padding:15px}.cs-ops-head,.cs-ops-title{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.cs-ops-head>div>span{color:var(--purple);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.cs-ops-head h2,.cs-ops-title h3{margin:0}.cs-ops-title a{color:var(--purple);text-decoration:none;font-size:12px}.cs-ops-kpis{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px;margin:13px 0}.cs-ops-kpis article,.cs-ops-grid article{background:#0d121d;border:1px solid var(--line);border-radius:13px;padding:13px}.cs-ops-kpis small,.cs-ops-kpis span,.cs-ops-row span{color:var(--muted)}.cs-ops-kpis strong{display:block;font-size:22px;margin:3px 0}.cs-ops-kpis span{font-size:10px}.cs-ops-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cs-ops-list{display:grid;gap:7px;margin-top:10px}.cs-ops-row{display:grid;gap:2px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#101522;text-decoration:none;color:var(--text)}.cs-ops-row:hover{border-color:rgba(139,92,246,.55)}.cs-ops-row span{font-size:11px}.cs-ops-empty{color:var(--muted);padding:12px;text-align:center}@media(max-width:1000px){.cs-ops-kpis{grid-template-columns:repeat(2,1fr)}.cs-ops-grid{grid-template-columns:1fr}}@media(max-width:600px){.cs-ops{margin-left:10px;margin-right:10px}.cs-ops-kpis{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
  window.addEventListener('load',()=>setTimeout(load,700));
})();
