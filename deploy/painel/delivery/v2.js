(() => {
  const API = '/api/crm/autonomy/delivery';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const json = async (url, options = {}) => {
    const r = await fetch(url, { credentials:'same-origin', cache:'no-store', ...options, headers:{ 'content-type':'application/json', ...(options.headers || {}) } });
    if (r.status === 401) { location.href = '/painel/login/?next=/painel/delivery/'; return null; }
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.ok === false) throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
    return data;
  };
  const post = (url, body = {}) => json(url, { method:'POST', body:JSON.stringify(body) });
  const patch = (url, body = {}) => json(url, { method:'PATCH', body:JSON.stringify(body) });

  const root = document.createElement('section');
  root.id = 'cs-delivery-v2';
  root.innerHTML = `
    <style>
      #cs-delivery-v2{margin-top:16px}.dv2-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.dv2-head h2{margin:0;font-size:18px}.dv2-head .dv2-actions{margin-left:auto;display:flex;gap:8px}.dv2-grid{display:grid;grid-template-columns:340px 1fr;gap:14px}.dv2-card{background:linear-gradient(145deg,#111827,#0d121e);border:1px solid rgba(255,255,255,.09);border-radius:15px;padding:15px}.dv2-list{display:grid;gap:8px;max-height:640px;overflow:auto}.dv2-project{border:1px solid rgba(255,255,255,.08);background:#0a101b;border-radius:11px;padding:11px;cursor:pointer}.dv2-project.active,.dv2-project:hover{border-color:#497fb1}.dv2-project b{display:block}.dv2-project small{color:#8f9bae}.dv2-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.dv2-badge{font-size:10px;padding:3px 7px;border-radius:999px;background:#17213a}.dv2-green{color:#48d99b}.dv2-amber{color:#ffc45f}.dv2-red{color:#ff6f84}.dv2-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}.dv2-kpi{background:#0a101b;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px}.dv2-kpi small{display:block;color:#8f9bae}.dv2-kpi strong{font-size:20px}.dv2-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.dv2-tab{border:1px solid rgba(255,255,255,.1);background:#101827;color:#f5f7fb;border-radius:8px;padding:7px 9px;cursor:pointer}.dv2-tab.active{border-color:#42a7ff;background:#17283d}.dv2-pane{display:none}.dv2-pane.active{display:block}.dv2-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06)}.dv2-row:last-child{border-bottom:0}.dv2-row small{color:#8f9bae}.dv2-select{background:#0a101b;color:#fff;border:1px solid #29465f;border-radius:7px;padding:5px}.dv2-empty{color:#8f9bae;padding:16px;text-align:center}.dv2-report{padding:10px;border-radius:9px;background:#0a101b;margin-bottom:8px}.dv2-notice{display:none;margin:8px 0;padding:9px;border-radius:8px;background:rgba(66,167,255,.09);border:1px solid rgba(66,167,255,.25)}.dv2-notice.show{display:block}@media(max-width:900px){.dv2-grid{grid-template-columns:1fr}.dv2-kpis{grid-template-columns:repeat(2,1fr)}}
    </style>
    <div class="dv2-head"><div><h2>Delivery v2 · Projeto e execução interna</h2><div class="sub">Projeto, backlog, status, release notes e incidentes. Shadow-first; sem ação externa automática.</div></div><div class="dv2-actions"><button class="btn" id="dv2Run">Executar ciclo</button><button class="btn" id="dv2Reload">Atualizar</button></div></div>
    <div id="dv2Notice" class="dv2-notice"></div>
    <div class="dv2-grid"><aside class="dv2-card"><h3>Projetos</h3><div id="dv2Projects" class="dv2-list"></div></aside><div class="dv2-card"><div id="dv2Empty" class="dv2-empty">Selecione um projeto.</div><div id="dv2Workspace" style="display:none"></div></div></div>`;
  document.querySelector('main.wrap')?.appendChild(root);

  let projects = [], activeId = null;
  const $ = (id) => document.getElementById(id);
  const notice = (text, error = false) => { const n=$('dv2Notice'); n.textContent=text; n.style.borderColor=error?'rgba(255,111,132,.4)':'rgba(66,167,255,.25)'; n.classList.add('show'); setTimeout(()=>n.classList.remove('show'),5000); };
  const healthClass = (h) => h === 'green' ? 'dv2-green' : h === 'red' ? 'dv2-red' : 'dv2-amber';

  async function load() {
    try {
      const data = await json(`${API}/projects?limit=100`);
      projects = data?.projects || [];
      renderProjects();
      if (activeId && projects.some((p) => p.id === activeId)) await selectProject(activeId);
      else if (projects[0]) await selectProject(projects[0].id);
    } catch (e) { notice(`Delivery v2: ${e.message}`, true); }
  }

  function renderProjects() {
    $('dv2Projects').innerHTML = projects.length ? projects.map((p) => `
      <div class="dv2-project ${p.id===activeId?'active':''}" data-dv2-project="${esc(p.id)}">
        <b>${esc(p.name)}</b><small>${esc(p.owner || 'Sem owner')} · ${esc(p.status)}</small>
        <div class="dv2-badges"><span class="dv2-badge ${healthClass(p.health)}">${esc(p.health)}</span><span class="dv2-badge">${p.backlogDone}/${p.backlogTotal} concluídos</span>${p.backlogBlocked?`<span class="dv2-badge dv2-red">${p.backlogBlocked} bloqueado(s)</span>`:''}${p.incidentsOpen?`<span class="dv2-badge dv2-amber">${p.incidentsOpen} incidente(s)</span>`:''}</div>
      </div>`).join('') : '<div class="dv2-empty">Nenhum projeto v2 ainda. Execute o ciclo para converter handoffs de negócios ganhos.</div>';
    document.querySelectorAll('[data-dv2-project]').forEach((el) => el.addEventListener('click', () => selectProject(el.dataset.dv2Project)));
  }

  async function selectProject(id) {
    activeId = id; renderProjects();
    try {
      const data = await json(`${API}/project/${encodeURIComponent(id)}`);
      renderWorkspace(data.project);
    } catch (e) { notice(e.message, true); }
  }

  function renderWorkspace(p) {
    $('dv2Empty').style.display='none'; $('dv2Workspace').style.display='block';
    const backlog = p.backlog || [], reports=p.reports||[], releases=p.releaseNotes||[], incidents=p.incidents||[];
    const done=backlog.filter(x=>x.status==='done').length, blocked=backlog.filter(x=>x.status==='blocked').length;
    $('dv2Workspace').innerHTML = `
      <div class="detail-head"><div><h2>${esc(p.name)}</h2><div class="sub">${esc(p.owner||'Sem owner')} · ${esc(p.status)} · saúde <span class="${healthClass(p.health)}">${esc(p.health)}</span></div></div><div class="detail-actions"><button class="btn" id="dv2Report">Gerar status</button><button class="btn" id="dv2Release">Gerar release notes</button></div></div>
      <div class="dv2-kpis"><div class="dv2-kpi"><small>Backlog</small><strong>${backlog.length}</strong></div><div class="dv2-kpi"><small>Concluídos</small><strong>${done}</strong></div><div class="dv2-kpi"><small>Bloqueados</small><strong>${blocked}</strong></div><div class="dv2-kpi"><small>Status reports</small><strong>${reports.length}</strong></div><div class="dv2-kpi"><small>Incidentes</small><strong>${incidents.filter(x=>!['resolved','closed'].includes(x.status)).length}</strong></div></div>
      <div class="dv2-tabs"><button class="dv2-tab active" data-pane="backlog">Backlog</button><button class="dv2-tab" data-pane="reports">Status</button><button class="dv2-tab" data-pane="releases">Release notes</button><button class="dv2-tab" data-pane="incidents">Incidentes/RCA</button></div>
      <div id="dv2-pane-backlog" class="dv2-pane active">${renderBacklog(backlog)}</div>
      <div id="dv2-pane-reports" class="dv2-pane">${renderReports(reports)}</div>
      <div id="dv2-pane-releases" class="dv2-pane">${renderReleases(releases)}</div>
      <div id="dv2-pane-incidents" class="dv2-pane">${renderIncidents(incidents)}<div style="margin-top:12px"><button class="btn" id="dv2Incident">Registrar incidente interno</button></div></div>`;
    document.querySelectorAll('.dv2-tab').forEach((el)=>el.onclick=()=>{document.querySelectorAll('.dv2-tab,.dv2-pane').forEach(x=>x.classList.remove('active'));el.classList.add('active');$(`dv2-pane-${el.dataset.pane}`).classList.add('active');});
    document.querySelectorAll('[data-backlog-status]').forEach((el)=>el.onchange=async()=>{try{await patch(`${API}/backlog/${encodeURIComponent(el.dataset.backlogStatus)}`,{status:el.value});await selectProject(p.id);}catch(e){notice(e.message,true);}});
    $('dv2Report').onclick=async()=>{try{await post(`${API}/project/${encodeURIComponent(p.id)}/report`);notice('Status report interno atualizado.');await selectProject(p.id);}catch(e){notice(e.message,true);}};
    $('dv2Release').onclick=async()=>{try{const r=await post(`${API}/project/${encodeURIComponent(p.id)}/release-notes`);notice(r.created?'Release notes em rascunho geradas.':`Nada gerado: ${r.reason||'sem itens concluídos'}`);await selectProject(p.id);}catch(e){notice(e.message,true);}};
    $('dv2Incident').onclick=async()=>{const title=prompt('Título do incidente interno:');if(!title)return;const severity=prompt('Severidade: low, medium, high ou critical','medium')||'medium';const description=prompt('Descrição / evidência inicial:','')||'';try{await post(`${API}/project/${encodeURIComponent(p.id)}/incident`,{title,severity,description});notice('Incidente registrado. RCA permanece como hipótese até validação humana.');await selectProject(p.id);}catch(e){notice(e.message,true);}};
  }

  function renderBacklog(rows) { return rows.length ? rows.map((x)=>`<div class="dv2-row"><div><b>${esc(x.itemType.toUpperCase())} · ${esc(x.title)}</b><small>${esc(x.description||'')}${x.blockedReason?` · Bloqueio: ${esc(x.blockedReason)}`:''}</small></div><select class="dv2-select" data-backlog-status="${esc(x.id)}">${['backlog','ready','doing','blocked','done','cancelled'].map(s=>`<option value="${s}" ${s===x.status?'selected':''}>${s}</option>`).join('')}</select></div>`).join('') : '<div class="dv2-empty">Backlog vazio.</div>'; }
  function renderReports(rows) { return rows.length ? rows.map((x)=>`<div class="dv2-report"><b>${esc(x.reportDate)} · <span class="${healthClass(x.health)}">${esc(x.health)}</span></b><div>${esc(x.summary)}</div><small>${(x.nextActions||[]).map(esc).join(' · ')}</small></div>`).join('') : '<div class="dv2-empty">Nenhum status report.</div>'; }
  function renderReleases(rows) { return rows.length ? rows.map((x)=>`<div class="dv2-report"><b>${esc(x.version)} · ${esc(x.status)}</b><div>${esc(x.summary)}</div><small>${(x.items||[]).map(i=>esc(i.title)).join(' · ')}</small></div>`).join('') : '<div class="dv2-empty">Nenhum rascunho de release notes.</div>'; }
  function renderIncidents(rows) { return rows.length ? rows.map((x)=>`<div class="dv2-report"><b>${esc(x.severity.toUpperCase())} · ${esc(x.title)} · ${esc(x.status)}</b><div>${esc(x.description||'')}</div><small>RCA: ${esc(x.rca?.rootCause || 'aguardando evidência/validação humana')}</small></div>`).join('') : '<div class="dv2-empty">Nenhum incidente registrado.</div>'; }

  $('dv2Run').onclick=async()=>{try{const r=await post(`${API}/run`);notice(`Ciclo executado: ${r.projectsCreated||0} projeto(s), ${r.backlogSeeded||0} item(ns), ${r.reportsGenerated||0} report(s).`);await load();}catch(e){notice(e.message,true);}};
  $('dv2Reload').onclick=load;
  load();
})();
