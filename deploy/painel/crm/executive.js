(() => {
  const CLOSED = new Set(['ganho','perdido','arquivado']);
  const PROB = {novo:.08,qualificacao:.15,contato_realizado:.22,discovery:.35,avaliacao_tecnica:.45,proposta:.60,negociacao:.78,follow_up:.55,ganho:1,perdido:0,nutricao:.12,arquivado:0};
  const moneyBR = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(value||0));
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sourceLabel = value => ({indicacao:'Indicação',linkedin:'LinkedIn',whatsapp:'WhatsApp',telefone:'Telefone',email:'E-mail',evento:'Evento',prospeccao_ativa:'Prospecção ativa',manual:'Manual',site:'Site',assistente:'Assistente',diagnostico:'Diagnóstico'}[String(value||'').toLowerCase()] || value || 'Não informada');
  const isOverdue = lead => {
    if (CLOSED.has(String(lead.status||'')) || !lead.nextActionDue) return false;
    const raw=String(lead.nextActionDue);
    const d=new Date(raw.length<=10?raw+'T23:59:59-03:00':raw);
    return !Number.isNaN(d.getTime()) && d < new Date();
  };
  const dueSoon = lead => {
    if (CLOSED.has(String(lead.status||'')) || !lead.nextActionDue) return false;
    const raw=String(lead.nextActionDue);
    const d=new Date(raw.length<=10?raw+'T23:59:59-03:00':raw);
    if(Number.isNaN(d.getTime())) return false;
    const diff=(d-new Date())/86400000;
    return diff>=0 && diff<=1.5;
  };
  const leadValue = l => Number(l.estimatedValue ?? l.value ?? l.expectedValue ?? 0) || 0;
  const createdAt = l => new Date(l.createdAt || l.created_at || l.updatedAt || 0).getTime() || 0;
  const updatedAt = l => new Date(l.updatedAt || l.updated_at || l.createdAt || 0).getTime() || 0;
  const hoursSince = ts => ts ? (Date.now()-ts)/3600000 : 9999;

  function ensureUI(){
    if(document.getElementById('crm-exec')) return;
    const stats=document.querySelector('.stats');
    if(!stats) return;
    const section=document.createElement('section');
    section.id='crm-exec';
    section.className='crm-exec';
    section.innerHTML=`
      <div class="crm-exec-head">
        <div><span class="crm-exec-kicker">Gestão comercial</span><h2>Resumo executivo</h2></div>
        <div class="crm-exec-actions"><button class="btn" data-exec-filter="overdue">Atrasados</button><button class="btn" data-exec-filter="hot">Quentes</button><button class="btn" data-exec-filter="unowned">Sem responsável</button><button class="btn" data-exec-filter="clear">Limpar filtros</button></div>
      </div>
      <div class="crm-exec-grid">
        <article class="crm-exec-card"><small>Forecast ponderado</small><strong id="xForecast">R$ 0</strong><span>Valor estimado × probabilidade da etapa</span></article>
        <article class="crm-exec-card"><small>Sem responsável</small><strong id="xUnowned">0</strong><span>Leads que precisam de dono</span></article>
        <article class="crm-exec-card"><small>SLA primeiro contato</small><strong id="xSla">0</strong><span>Novos há mais de 4h sem avanço</span></article>
        <article class="crm-exec-card"><small>Conversão para ganho</small><strong id="xConversion">0%</strong><span>Ganhos ÷ oportunidades encerradas</span></article>
      </div>
      <div class="crm-exec-split">
        <article class="crm-exec-panel"><div class="crm-exec-title"><h3>Atender agora</h3><span id="xQueueCount">0 itens</span></div><div id="xQueue" class="crm-exec-queue"></div></article>
        <article class="crm-exec-panel"><div class="crm-exec-title"><h3>Origem dos leads</h3><span>volume / pipeline</span></div><div id="xSources" class="crm-exec-sources"></div></article>
      </div>`;
    stats.insertAdjacentElement('afterend',section);
    section.addEventListener('click',event=>{
      const button=event.target.closest('[data-exec-filter]');
      if(!button) return;
      const kind=button.dataset.execFilter;
      const search=document.getElementById('search');
      const temp=document.getElementById('temp');
      const owner=document.getElementById('owner');
      if(kind==='overdue' && search){ search.value=''; window.__csExecFilter='overdue'; }
      if(kind==='hot' && temp){ temp.value='quente'; temp.dispatchEvent(new Event('change',{bubbles:true})); window.__csExecFilter=''; }
      if(kind==='unowned' && owner){ owner.value=''; window.__csExecFilter='unowned'; }
      if(kind==='clear'){ if(search) search.value=''; if(temp) temp.value=''; if(owner) owner.value=''; window.__csExecFilter=''; }
      document.getElementById('refresh')?.click();
      render();
    });
  }

  function render(){
    ensureUI();
    if(typeof leads==='undefined' || !Array.isArray(leads) || !document.getElementById('crm-exec')) return;
    const open=leads.filter(l=>!CLOSED.has(String(l.status||'')));
    const forecast=open.reduce((sum,l)=>sum+leadValue(l)*(PROB[String(l.status||'novo')] ?? .1),0);
    const unowned=open.filter(l=>!String(l.owner||l.assignee||'').trim());
    const sla=open.filter(l=>String(l.status||'')==='novo' && hoursSince(createdAt(l))>4);
    const won=leads.filter(l=>String(l.status||'')==='ganho').length;
    const lost=leads.filter(l=>String(l.status||'')==='perdido').length;
    const conversion=(won+lost)?Math.round((won/(won+lost))*100):0;
    document.getElementById('xForecast').textContent=moneyBR(forecast);
    document.getElementById('xUnowned').textContent=String(unowned.length);
    document.getElementById('xSla').textContent=String(sla.length);
    document.getElementById('xConversion').textContent=`${conversion}%`;

    const queue=open.map(l=>{
      let priority=0,reason='';
      if(isOverdue(l)){priority+=100;reason='Follow-up vencido';}
      if(String(l.temperature||l.temperatura||'').toLowerCase()==='quente' || Number(l.leadScore||l.score||0)>=70){priority+=45;reason=reason||'Lead quente';}
      if(!String(l.owner||l.assignee||'').trim()){priority+=30;reason=reason||'Sem responsável';}
      if(String(l.status||'')==='novo' && hoursSince(createdAt(l))>4){priority+=55;reason=reason||'SLA de primeiro contato';}
      if(dueSoon(l)){priority+=25;reason=reason||'Ação vence hoje';}
      priority+=Math.min(20,Math.floor(hoursSince(updatedAt(l))/24));
      return {l,priority,reason};
    }).filter(x=>x.priority>=25).sort((a,b)=>b.priority-a.priority).slice(0,8);
    document.getElementById('xQueueCount').textContent=`${queue.length} itens`;
    document.getElementById('xQueue').innerHTML=queue.length?queue.map(({l,reason,priority})=>`<button class="crm-exec-row" data-lead-id="${esc(l.id)}"><span><b>${esc(l.name||l.company||'Lead')}</b><small>${esc(l.company||l.need||l.segment||'')}</small></span><span><em>${esc(reason)}</em><small>${priority} pts</small></span></button>`).join(''):'<div class="crm-exec-empty">Nenhuma urgência comercial identificada.</div>';

    const bySource=new Map();
    for(const l of leads){const key=sourceLabel(l.source||l.origin||l.utmSource);const curr=bySource.get(key)||{count:0,value:0};curr.count++;curr.value+=CLOSED.has(String(l.status||''))?0:leadValue(l);bySource.set(key,curr);}
    const sources=[...bySource.entries()].sort((a,b)=>b[1].count-a[1].count).slice(0,8);
    const max=Math.max(1,...sources.map(([,v])=>v.count));
    document.getElementById('xSources').innerHTML=sources.length?sources.map(([name,v])=>`<div class="crm-source"><div><b>${esc(name)}</b><span>${v.count} leads · ${moneyBR(v.value)}</span></div><div class="crm-source-bar"><i style="width:${Math.max(5,Math.round(v.count/max*100))}%"></i></div></div>`).join(''):'<div class="crm-exec-empty">Sem dados de origem.</div>';

    document.querySelectorAll('[data-lead-id]').forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.leadId;
      const card=[...document.querySelectorAll('.card')].find(el=>el.dataset?.id===id || el.getAttribute('data-lead-id')===id);
      if(card){card.click();card.scrollIntoView({behavior:'smooth',block:'center'});}
      else { const match=leads.find(l=>String(l.id)===String(id)); if(match && typeof openLead==='function') openLead(match); }
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    .crm-exec{margin:0 18px 18px;border:1px solid var(--line);background:rgba(255,255,255,.018);border-radius:16px;padding:15px}.crm-exec-head,.crm-exec-title{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.crm-exec-head h2,.crm-exec-title h3{margin:0}.crm-exec-kicker{display:block;color:var(--purple);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;margin-bottom:3px}.crm-exec-actions{display:flex;gap:7px;flex-wrap:wrap}.crm-exec-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin-top:13px}.crm-exec-card,.crm-exec-panel{background:#0d121d;border:1px solid var(--line);border-radius:13px;padding:13px}.crm-exec-card small,.crm-exec-card span,.crm-exec-title span,.crm-source span,.crm-exec-row small{color:var(--muted)}.crm-exec-card strong{display:block;font-size:22px;margin:3px 0}.crm-exec-card span{font-size:10px}.crm-exec-split{display:grid;grid-template-columns:1.15fr .85fr;gap:10px;margin-top:10px}.crm-exec-queue,.crm-exec-sources{margin-top:10px;display:grid;gap:7px}.crm-exec-row{width:100%;border:1px solid var(--line);background:#101522;color:var(--text);border-radius:10px;padding:9px 10px;display:flex;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}.crm-exec-row:hover{border-color:rgba(139,92,246,.55)}.crm-exec-row span{display:grid;gap:2px}.crm-exec-row span:last-child{text-align:right}.crm-exec-row em{font-style:normal;color:var(--amber);font-size:11px}.crm-source{display:grid;gap:5px}.crm-source>div:first-child{display:flex;justify-content:space-between;gap:8px}.crm-source-bar{height:5px;background:#171d2b;border-radius:99px;overflow:hidden}.crm-source-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--purple),var(--blue));border-radius:99px}.crm-exec-empty{color:var(--muted);padding:13px;text-align:center}@media(max-width:980px){.crm-exec-grid{grid-template-columns:repeat(2,1fr)}.crm-exec-split{grid-template-columns:1fr}}@media(max-width:600px){.crm-exec-grid{grid-template-columns:1fr}.crm-exec{margin-left:10px;margin-right:10px}}`;
  document.head.appendChild(style);

  let lastSignature='';
  setInterval(()=>{
    if(typeof leads==='undefined' || !Array.isArray(leads)) return;
    const sig=`${leads.length}:${leads.map(l=>`${l.id}:${l.status}:${l.updatedAt||l.updated_at||''}`).join('|')}`;
    if(sig!==lastSignature){lastSignature=sig;render();}
  },1200);
  window.addEventListener('load',()=>setTimeout(render,400));
})();
