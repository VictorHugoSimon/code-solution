import fs from 'node:fs/promises';

const files = [
  'deploy/painel/index.html',
  'deploy/painel/crm/index.html',
  'deploy/painel/crm/autonomia/index.html',
  'deploy/painel/crm/propostas/index.html',
  'deploy/painel/marketing/index.html',
  'deploy/painel/inteligencia/index.html',
  'deploy/painel/growth/index.html',
  'deploy/painel/atendimento/index.html',
  'deploy/painel/agenda/index.html',
  'deploy/painel/prospeccao/index.html',
  'deploy/painel/relatorios/index.html',
  'deploy/painel/relatorios/saude/index.html',
  'deploy/painel/usuarios/index.html',
  'deploy/painel/conta/index.html',
];

const links = [
  ['/painel/', 'Visão geral', 'visao', 'overview', '⌂'],
  ['/painel/crm/', 'CRM', 'crm', 'crm_read', '◆'],
  ['/painel/crm/autonomia/', 'Agentes', 'autonomia', 'crm_read', '✦'],
  ['/painel/crm/propostas/', 'Propostas', 'propostas', 'crm_read', '▤'],
  ['/painel/atendimento/', 'Atendimento', 'atendimento', 'attendance', '◉'],
  ['/painel/agenda/', 'Agenda', 'agenda', 'agenda', '▣'],
  ['/painel/prospeccao/', 'Prospecção', 'prospeccao', 'prospecting', '◎'],
  ['/painel/marketing/', 'Marketing', 'marketing', 'marketing', '↗'],
  ['/painel/inteligencia/', 'Inteligência', 'inteligencia', 'intelligence', '◇'],
  ['/painel/growth/', 'Growth', 'growth', 'growth', '↑'],
  ['/painel/relatorios/', 'Relatórios', 'relatorios', 'reports', '▥'],
  ['/painel/relatorios/saude/', 'Saúde', 'saude', 'reports', '●'],
  ['/painel/usuarios/', 'Usuários', 'usuarios', 'users', '♙'],
  ['/painel/conta/', 'Minha conta', 'conta', '', '○'],
];

const shellStyle = `<style data-cs-panel-shell>
:root{--cs-side-w:248px;--cs-side-bg:#090d17;--cs-side-card:#111827;--cs-side-line:rgba(255,255,255,.08);--cs-side-text:#eef2f8;--cs-side-muted:#8e9caf;--cs-side-purple:#8b5cf6;--cs-side-red:#ff647c;--cs-side-amber:#ffc45e;--cs-side-green:#48d99b}
body{padding-left:var(--cs-side-w)!important}.cs-sidebar{position:fixed;inset:0 auto 0 0;width:var(--cs-side-w);z-index:2147483000;background:linear-gradient(180deg,#0d1220,#080b13);border-right:1px solid var(--cs-side-line);display:flex;flex-direction:column;color:var(--cs-side-text);font:13px/1.35 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:12px 0 42px rgba(0,0,0,.14)}.cs-side-brand{padding:20px 17px 14px;font-size:16px;font-weight:950;letter-spacing:.02em}.cs-side-brand b{color:#9b72ff}.cs-side-head{padding:0 12px 12px;display:grid;grid-template-columns:1fr 42px;gap:8px}.cs-human-summary,.cs-bell{border:1px solid var(--cs-side-line);background:#111827;color:inherit;border-radius:12px;min-height:42px}.cs-human-summary{display:flex;align-items:center;gap:8px;padding:9px 10px;text-decoration:none;font-size:11px;font-weight:800}.cs-human-summary.has-action{border-color:rgba(255,196,94,.34);background:rgba(255,196,94,.08);color:#ffe1a8}.cs-human-summary i{width:8px;height:8px;border-radius:99px;background:var(--cs-side-green);flex:0 0 auto}.cs-human-summary.has-action i{background:var(--cs-side-amber);box-shadow:0 0 0 4px rgba(255,196,94,.09)}.cs-bell{position:relative;cursor:pointer;display:grid;place-items:center}.cs-bell svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8}.cs-bell-badge{position:absolute;right:-5px;top:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--cs-side-red);color:#fff;display:none;place-items:center;font-size:10px;font-weight:900;border:2px solid #0c111c}.cs-bell.has-unread .cs-bell-badge{display:grid}.cs-side-nav{padding:2px 10px 14px;overflow:auto;display:grid;gap:4px}.cs-side-link{display:flex;align-items:center;gap:10px;color:#c9d1dd;text-decoration:none;padding:9px 10px;border-radius:10px;border:1px solid transparent;min-height:39px;position:relative}.cs-side-link:hover{background:#131a28;color:#fff}.cs-side-link.active{background:linear-gradient(135deg,rgba(139,92,246,.20),rgba(139,92,246,.08));border-color:rgba(155,114,255,.27);color:#fff}.cs-side-icon{width:22px;text-align:center;color:#9ca9ba;font-size:15px}.cs-side-link.active .cs-side-icon{color:#bda4ff}.cs-action-badge{margin-left:auto;display:none;min-width:21px;height:21px;padding:0 6px;border-radius:999px;align-items:center;justify-content:center;background:rgba(255,100,124,.14);border:1px solid rgba(255,100,124,.30);color:#ff9dad;font-size:10px;font-weight:900}.cs-action-badge.visible{display:inline-flex}.cs-side-quick{padding:10px;border-top:1px solid var(--cs-side-line);margin-top:auto}.cs-side-newlead{width:100%;border:0;border-radius:10px;background:linear-gradient(135deg,#7650dd,#925eff);color:#fff;padding:10px;font:800 12px system-ui;cursor:pointer;margin-bottom:7px}.cs-side-exit{display:flex;align-items:center;justify-content:center;padding:9px;color:#9facbd;text-decoration:none;border:1px solid var(--cs-side-line);border-radius:10px;background:#0d1420}.cs-notification-pop{position:fixed;left:258px;top:16px;width:min(390px,calc(100vw - 280px));max-height:calc(100vh - 32px);overflow:auto;z-index:2147483600;background:#0d1420;border:1px solid rgba(255,255,255,.11);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.42);padding:14px;color:#eef2f8;display:none;font:13px/1.4 system-ui}.cs-notification-pop.open{display:block}.cs-notification-pop h3{font-size:15px;margin:0}.cs-notif-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--cs-side-line)}.cs-notif-close{border:0;background:transparent;color:#aab6c5;font-size:20px;cursor:pointer}.cs-notif-section{padding:11px 0;border-bottom:1px solid var(--cs-side-line)}.cs-notif-section:last-child{border-bottom:0}.cs-notif-title{display:flex;justify-content:space-between;gap:8px;font-weight:850;margin-bottom:6px}.cs-notif-item{display:block;color:#d9e2ec;text-decoration:none;background:#111b2a;border:1px solid var(--cs-side-line);border-radius:9px;padding:8px 9px;margin-top:6px}.cs-notif-item small{display:block;color:#8594a8;margin-top:2px}.cs-notif-empty{color:#8594a8;font-size:12px}.cs-lead-toast{position:fixed;right:18px;top:18px;z-index:2147483640;background:#122318;border:1px solid rgba(72,217,155,.35);color:#d4ffea;border-radius:13px;padding:12px 14px;box-shadow:0 16px 50px rgba(0,0,0,.35);transform:translateY(-130%);opacity:0;transition:.22s ease;font:700 13px system-ui;max-width:340px}.cs-lead-toast.show{transform:translateY(0);opacity:1}.cs-mobile-menu{display:none;position:fixed;left:12px;top:12px;z-index:2147483650;width:42px;height:42px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:#0d1420;color:#fff;font-size:20px;box-shadow:0 8px 28px rgba(0,0,0,.3)}
@media(max-width:900px){body{padding-left:0!important}.cs-sidebar{transform:translateX(-102%);transition:transform .22s ease}.cs-sidebar.mobile-open{transform:translateX(0)}.cs-mobile-menu{display:block}.cs-notification-pop{left:12px;top:64px;width:calc(100vw - 24px);max-height:calc(100vh - 80px)}body.cs-side-open:after{content:"";position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:2147482990}}
</style>`;

const shellScript = `<script data-cs-panel-shell>
(function(){
  const sidebar=document.querySelector('.cs-sidebar'); if(!sidebar)return;
  const bell=document.getElementById('csBell'), bellBadge=document.getElementById('csBellBadge'), pop=document.getElementById('csNotifications'), human=document.getElementById('csHumanSummary'), humanText=document.getElementById('csHumanText'), toast=document.getElementById('csLeadToast');
  const mobile=document.getElementById('csMobileMenu'), close=document.getElementById('csNotifClose');
  const closedStages=new Set(['ganho','perdido','arquivado']);
  const seenKey='cs_seen_new_leads_v1'; let lastNewIds=[]; let initialized=false;
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function get(url){try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(r.status===401){location.href='/painel/login/?next='+encodeURIComponent(location.pathname);return null;}if(!r.ok)return null;return await r.json();}catch{return null;}}
  function badge(key,count){const el=document.querySelector('[data-cs-action="'+key+'"]');if(!el)return;el.textContent=String(count||0);el.classList.toggle('visible',Number(count)>0);}
  function duePast(value){if(!value)return false;const d=new Date(String(value).length<=10?value+'T23:59:59-03:00':value);return !Number.isNaN(d.getTime())&&d.getTime()<Date.now();}
  function savedSeen(){try{return new Set(JSON.parse(localStorage.getItem(seenKey)||'[]'));}catch{return new Set();}}
  function markSeen(ids){try{localStorage.setItem(seenKey,JSON.stringify(ids.slice(0,250)));}catch{}}
  function notifyLead(count){if(!toast||count<1)return;toast.textContent=count===1?'Novo lead recebido no CRM':' '+count+' novos leads recebidos no CRM';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),5200);}
  function renderNotifications(newLeads,overdue,approvals,actionLeads){
    if(!pop)return;
    const leadHtml=newLeads.slice(0,8).map(l=>'<a class="cs-notif-item" href="/painel/crm/?lead='+encodeURIComponent(l.id)+'"><strong>'+esc(l.name||l.company||'Novo lead')+'</strong><small>'+esc(l.company||l.source||'Origem não informada')+' · '+esc(l.temperature||'')+'</small></a>').join('');
    const overdueHtml=overdue.slice(0,6).map(l=>'<a class="cs-notif-item" href="/painel/crm/?lead='+encodeURIComponent(l.id)+'"><strong>'+esc(l.name||l.company||'Lead')+'</strong><small>Follow-up vencido · '+esc(l.nextAction||'ação pendente')+'</small></a>').join('');
    const approvalHtml=approvals.slice(0,6).map(a=>{const t=a.task||a;return '<a class="cs-notif-item" href="/painel/crm/autonomia/"><strong>'+esc(t.title||'Aprovação de agente')+'</strong><small>Requer decisão humana antes de continuar</small></a>'}).join('');
    document.getElementById('csNotifBody').innerHTML='<section class="cs-notif-section"><div class="cs-notif-title"><span>Novos leads</span><b>'+newLeads.length+'</b></div>'+(leadHtml||'<div class="cs-notif-empty">Nenhum lead novo aguardando tratamento.</div>')+'</section><section class="cs-notif-section"><div class="cs-notif-title"><span>Follow-ups vencidos</span><b>'+overdue.length+'</b></div>'+(overdueHtml||'<div class="cs-notif-empty">Nenhum follow-up vencido.</div>')+'</section><section class="cs-notif-section"><div class="cs-notif-title"><span>Aprovação humana</span><b>'+approvals.length+'</b></div>'+(approvalHtml||'<div class="cs-notif-empty">Nenhuma aprovação pendente.</div>')+'</section><section class="cs-notif-section"><div class="cs-notif-title"><span>Total exigindo ação</span><b>'+actionLeads.length+'</b></div><div class="cs-notif-empty">O badge do CRM permanece visível até os leads saírem da condição de ação pendente.</div></section>';
  }
  async function refresh(){
    const session=await get('/api/auth/session');
    const permissions=new Set(session?.permissions||[]);
    document.querySelectorAll('[data-cs-permission]').forEach(a=>{const p=a.dataset.csPermission;if(p&&!permissions.has(p))a.style.display='none';});
    const canCrm=permissions.has('crm_read');
    const [leadData,autoData]=await Promise.all([canCrm?get('/api/crm/leads?limit=250'):null,canCrm?get('/api/crm/autonomy'):null]);
    const leads=Array.isArray(leadData?.leads)?leadData.leads:[];
    const newLeads=leads.filter(l=>l.status==='novo');
    const overdue=leads.filter(l=>!closedStages.has(l.status)&&duePast(l.nextActionDue));
    const actionLeads=leads.filter(l=>!closedStages.has(l.status)&&(l.status==='novo'||!l.nextAction||duePast(l.nextActionDue)));
    const approvals=Array.isArray(autoData?.pendingApprovals)?autoData.pendingApprovals:[];
    const proposalApprovals=approvals.filter(a=>/propost|proposal/i.test(JSON.stringify(a)));
    badge('crm',actionLeads.length); badge('atendimento',newLeads.length); badge('agenda',overdue.length); badge('autonomia',approvals.length); badge('propostas',proposalApprovals.length);
    const humanTotal=actionLeads.length+approvals.length;
    human.classList.toggle('has-action',humanTotal>0); humanText.textContent=humanTotal>0?humanTotal+' ações humanas':'Sem ações pendentes';
    const ids=newLeads.map(l=>String(l.id)).filter(Boolean); const seen=savedSeen(); const unread=ids.filter(id=>!seen.has(id));
    bell.classList.toggle('has-unread',unread.length>0); bellBadge.textContent=String(unread.length);
    if(initialized){const newlyArrived=ids.filter(id=>!lastNewIds.includes(id));if(newlyArrived.length)notifyLead(newlyArrived.length);}else if(unread.length)notifyLead(unread.length);
    initialized=true; lastNewIds=ids; renderNotifications(newLeads,overdue,approvals,actionLeads);
  }
  bell?.addEventListener('click',()=>{const opening=!pop.classList.contains('open');pop.classList.toggle('open',opening);if(opening){markSeen(lastNewIds);bell.classList.remove('has-unread');bellBadge.textContent='0';}});
  close?.addEventListener('click',()=>pop.classList.remove('open'));
  mobile?.addEventListener('click',()=>{const open=!sidebar.classList.contains('mobile-open');sidebar.classList.toggle('mobile-open',open);document.body.classList.toggle('cs-side-open',open)});
  document.addEventListener('click',e=>{if(window.innerWidth<=900&&sidebar.classList.contains('mobile-open')&&!sidebar.contains(e.target)&&e.target!==mobile){sidebar.classList.remove('mobile-open');document.body.classList.remove('cs-side-open')}});
  refresh();setInterval(refresh,20000);
})();
</script>`;

function currentModule(file) {
  if (file.endsWith('/painel/index.html')) return 'visao';
  if (file.includes('/crm/autonomia/')) return 'autonomia';
  if (file.includes('/crm/propostas/')) return 'propostas';
  if (file.includes('/crm/')) return 'crm';
  if (file.includes('/atendimento/')) return 'atendimento';
  if (file.includes('/agenda/')) return 'agenda';
  if (file.includes('/prospeccao/')) return 'prospeccao';
  if (file.includes('/marketing/')) return 'marketing';
  if (file.includes('/inteligencia/')) return 'inteligencia';
  if (file.includes('/growth/')) return 'growth';
  if (file.includes('/relatorios/saude/')) return 'saude';
  if (file.includes('/relatorios/')) return 'relatorios';
  if (file.includes('/usuarios/')) return 'usuarios';
  if (file.includes('/conta/')) return 'conta';
  return 'visao';
}

function sidebar(module) {
  const anchors = links.map(([href,label,key,permission,icon]) => `<a class="cs-side-link${module===key?' active':''}" href="${href}" data-cs-module="${key}"${permission?` data-cs-permission="${permission}"`:''}><span class="cs-side-icon">${icon}</span><span>${label}</span><span class="cs-action-badge" data-cs-action="${key}" aria-label="ações pendentes"></span></a>`).join('');
  const newLead = module === 'crm' ? '<button id="newLead" class="cs-side-newlead" type="button">+ Novo lead</button>' : '';
  return `<button id="csMobileMenu" class="cs-mobile-menu" type="button" aria-label="Abrir menu">☰</button><aside class="cs-sidebar" aria-label="Navegação do painel"><div class="cs-side-brand">CODE <b>SOLUTION</b><br><small style="color:#748396;font-weight:650">Painel operacional</small></div><div class="cs-side-head"><a id="csHumanSummary" class="cs-human-summary" href="/painel/crm/"><i></i><span id="csHumanText">Verificando ações…</span></a><button id="csBell" class="cs-bell" type="button" aria-label="Notificações"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span id="csBellBadge" class="cs-bell-badge">0</span></button></div><nav class="cs-side-nav">${anchors}</nav><div class="cs-side-quick">${newLead}<a class="cs-side-exit" href="/painel/logout/">Sair do painel</a></div></aside><section id="csNotifications" class="cs-notification-pop" aria-label="Central de notificações"><div class="cs-notif-head"><h3>Notificações e ação humana</h3><button id="csNotifClose" class="cs-notif-close" type="button" aria-label="Fechar">×</button></div><div id="csNotifBody"><div class="cs-notif-empty">Carregando…</div></div></section><div id="csLeadToast" class="cs-lead-toast" role="status" aria-live="polite"></div>`;
}

function upgradeAgentCenter(html) {
  let out = html;
  out = out.replace(
    "||(ta==='content'&&ak.includes('conte')))});}",
    "||(ta==='content'&&ak.includes('conte'))||(ta==='executive'&&ak.includes('execut'))||(ta==='delivery'&&ak.includes('delivery')))});}",
  );
  out = out.replace(
    "const latest=mine[0];return{className:'',label:'Ativo',task:latest||null};}",
    "const latest=mine[0];return{className:'',label:String(agent.status)==='active-shadow'?'Shadow':'Ativo',task:latest||null};}",
  );
  out = out.replace(
    /<section class="panel" style="margin-top:12px"><h2>Próximos agentes<\/h2><div id="planned">[\s\S]*?<\/div><\/section><section class="panel" style="margin-top:12px"><h2>Política de segurança<\/h2>/,
    `<section class="panel" style="margin-top:12px"><h2>Próximas automações</h2><div id="planned"><div class="planned"><strong>Customer Success Agent</strong><span class="muted">Adoção, satisfação, riscos de churn e oportunidades de expansão.</span><br><span class="pill">Planejado</span></div><div class="planned"><strong>Finance Agent</strong><span class="muted">Indicadores financeiros internos e alertas; pagamentos e compromissos continuam exigindo aprovação humana.</span><br><span class="pill">Planejado</span></div></div></section><section class="panel" style="margin-top:12px"><h2>Política de segurança</h2>`,
  );
  return out;
}

for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  html = html.replace(/<style data-cs-panel-shell>[\s\S]*?<\/style>/g,'').replace(/<script data-cs-panel-shell>[\s\S]*?<\/script>/g,'');
  html = html.replace(/<button id="csMobileMenu"[\s\S]*?<div id="csLeadToast" class="cs-lead-toast" role="status" aria-live="polite"><\/div>/g,'');
  const start = html.indexOf('<header class="top">');
  const end = start >= 0 ? html.indexOf('</header>', start) : -1;
  const module = currentModule(file);
  if (start >= 0 && end >= 0) html = html.slice(0,start) + sidebar(module) + html.slice(end + '</header>'.length);
  else if (!html.includes('class="cs-sidebar"')) html = html.replace(/<body([^>]*)>/i, `<body$1>${sidebar(module)}`);
  if (!html.includes('data-cs-panel-shell')) html = html.replace('</head>', `${shellStyle}</head>`).replace('</body>', `${shellScript}</body>`);
  if (module === 'autonomia') html = upgradeAgentCenter(html);
  await fs.writeFile(file, html);
  console.log(`Panel sidebar + action center applied: ${file}`);
}
