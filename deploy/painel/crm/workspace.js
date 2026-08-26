(() => {
  'use strict';

  const API = '/api/crm/leads?limit=250';
  const STORAGE_KEY = 'cs_crm_notifications_seen_v1';
  const POLL_MS = 15000;
  const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  let latestLeads = [];
  let panelOpen = false;
  let pollBusy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const when = value => {
    const d = new Date(value || 0);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  };
  const createdMs = lead => new Date(lead.createdAt || lead.created_at || lead.updatedAt || 0).getTime() || 0;
  const humanAction = lead => {
    const medium = String(lead.medium || '').toLowerCase();
    const content = String(lead.content || '').toLowerCase();
    return medium === 'acao_humana' || content === 'handoff_requested' || content.includes('human_action');
  };
  const notificationKey = lead => `${humanAction(lead) ? 'human' : 'lead'}:${lead.id}`;

  function readSeen(){
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function saveSeen(set){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-1000))); } catch {}
  }

  function notifications(){
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return latestLeads
      .filter(lead => createdMs(lead) >= cutoff || humanAction(lead))
      .map(lead => ({
        key: notificationKey(lead),
        type: humanAction(lead) ? 'human' : 'lead',
        lead,
        at: lead.updatedAt || lead.updated_at || lead.createdAt || lead.created_at,
      }))
      .sort((a,b) => new Date(b.at || 0) - new Date(a.at || 0));
  }

  function ensureUI(){
    if(document.getElementById('csNotifyButton')) return;
    const row = document.querySelector('.top .row');
    const newLead = document.getElementById('newLead');
    if(!row || !newLead) return;

    const shell = document.createElement('div');
    shell.className = 'cs-notify-shell';
    shell.innerHTML = `
      <button id="csHumanQuick" class="cs-human-quick" type="button" title="Ações humanas pendentes">
        <span class="cs-human-dot"></span><span>Ações humanas</span><b id="csHumanCount">0</b>
      </button>
      <button id="csNotifyButton" class="cs-notify-button" type="button" aria-label="Notificações" aria-expanded="false">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span id="csNotifyBadge" class="cs-notify-badge hidden">0</span>
      </button>
      <aside id="csNotifyPanel" class="cs-notify-panel" aria-label="Central de notificações">
        <header><div><b>Notificações</b><span>Novo lead e ação humana</span></div><button id="csMarkAllRead" type="button">Marcar lidas</button></header>
        <div id="csNotifyList" class="cs-notify-list"></div>
      </aside>`;
    row.insertBefore(shell, newLead);

    document.getElementById('csNotifyButton').onclick = event => {
      event.stopPropagation();
      panelOpen = !panelOpen;
      document.getElementById('csNotifyPanel').classList.toggle('open', panelOpen);
      document.getElementById('csNotifyButton').setAttribute('aria-expanded', String(panelOpen));
    };
    document.getElementById('csMarkAllRead').onclick = event => {
      event.stopPropagation();
      const seen = readSeen();
      notifications().forEach(item => seen.add(item.key));
      saveSeen(seen);
      render();
    };
    document.getElementById('csHumanQuick').onclick = () => {
      panelOpen = true;
      document.getElementById('csNotifyPanel').classList.add('open');
      render('human');
    };
    document.addEventListener('click', event => {
      if(panelOpen && !event.target.closest('.cs-notify-shell')){
        panelOpen = false;
        document.getElementById('csNotifyPanel')?.classList.remove('open');
      }
    });
  }

  function render(filter = ''){
    ensureUI();
    const list = document.getElementById('csNotifyList');
    if(!list) return;
    const seen = readSeen();
    const items = notifications();
    const unread = items.filter(item => !seen.has(item.key));
    const humans = latestLeads.filter(humanAction).filter(l => !['ganho','perdido','arquivado'].includes(String(l.status || '')));
    const badge = document.getElementById('csNotifyBadge');
    badge.textContent = String(unread.length);
    badge.classList.toggle('hidden', unread.length === 0);
    document.getElementById('csHumanCount').textContent = String(humans.length);

    const visible = (filter === 'human' ? items.filter(item => item.type === 'human') : items).slice(0, 30);
    list.innerHTML = visible.length ? visible.map(item => {
      const l = item.lead;
      const isHuman = item.type === 'human';
      const isUnread = !seen.has(item.key);
      return `<button class="cs-notify-item ${isHuman ? 'human' : ''} ${isUnread ? 'unread' : ''}" type="button" data-notify-key="${esc(item.key)}" data-lead-id="${esc(l.id)}">
        <span class="cs-notify-icon">${isHuman ? '👤' : '✦'}</span>
        <span class="cs-notify-copy"><b>${isHuman ? 'AÇÃO HUMANA' : 'NOVO LEAD'}</b><strong>${esc(l.name || l.company || 'Lead')}</strong><small>${esc(l.company || l.need || 'Sem empresa informada')}</small><time>${esc(when(item.at))}</time></span>
        ${isUnread ? '<i class="cs-unread-dot"></i>' : ''}
      </button>`;
    }).join('') : '<div class="cs-notify-empty">Nenhuma notificação recente.</div>';

    list.querySelectorAll('[data-lead-id]').forEach(button => button.onclick = () => {
      const key = button.dataset.notifyKey;
      const id = button.dataset.leadId;
      const seenNow = readSeen(); seenNow.add(key); saveSeen(seenNow);
      openLeadById(id);
      panelOpen = false;
      document.getElementById('csNotifyPanel').classList.remove('open');
      render();
    });

    decorateHumanLeads();
  }

  function openLeadById(id){
    const lead = latestLeads.find(item => String(item.id) === String(id));
    try {
      if(lead && typeof openLead === 'function'){ openLead(lead); return; }
    } catch {}
    const search = document.getElementById('search');
    if(search && lead){
      search.value = lead.name || lead.company || '';
      search.dispatchEvent(new Event('input', {bubbles:true}));
      document.getElementById('refresh')?.click();
    }
  }

  function decorateHumanLeads(){
    const humans = latestLeads.filter(humanAction);
    const byId = new Map(humans.map(l => [String(l.id), l]));
    document.querySelectorAll('.card').forEach(card => {
      const id = String(card.dataset?.id || card.getAttribute('data-lead-id') || '');
      let lead = id ? byId.get(id) : null;
      if(!lead){
        const title = card.querySelector('h3')?.textContent?.trim();
        if(title) lead = humans.find(l => String(l.name || '').trim() === title);
      }
      card.classList.toggle('cs-human-card', Boolean(lead));
      let flag = card.querySelector('.cs-human-flag');
      if(lead && !flag){
        flag = document.createElement('div');
        flag.className = 'cs-human-flag';
        flag.textContent = '👤 AÇÃO HUMANA';
        card.prepend(flag);
      } else if(!lead && flag) flag.remove();
    });

    const drawer = document.querySelector('.drawer');
    if(drawer && typeof active !== 'undefined'){
      const current = active && latestLeads.find(l => String(l.id) === String(active.id));
      let banner = document.getElementById('csHumanDrawerBanner');
      if(current && humanAction(current)){
        if(!banner){
          banner = document.createElement('div');
          banner.id = 'csHumanDrawerBanner';
          banner.className = 'cs-human-drawer';
          const anchor = drawer.querySelector('.row');
          anchor?.insertAdjacentElement('afterend', banner);
        }
        banner.innerHTML = '<b>👤 AÇÃO HUMANA SOLICITADA</b><span>Este lead pediu continuidade com uma pessoa da equipe. Priorize o contato e registre o responsável.</span>';
      } else if(banner) banner.remove();
    }
  }

  function toast(item){
    if(!item) return;
    let root = document.getElementById('csNotifyToastRoot');
    if(!root){ root = document.createElement('div'); root.id='csNotifyToastRoot'; document.body.appendChild(root); }
    const el = document.createElement('button');
    el.type='button'; el.className=`cs-notify-toast ${item.type === 'human' ? 'human' : ''}`;
    el.innerHTML=`<b>${item.type === 'human' ? '👤 Ação humana solicitada' : '✦ Novo lead recebido'}</b><span>${esc(item.lead.name || item.lead.company || 'Novo contato')}</span>`;
    el.onclick=()=>{openLeadById(item.lead.id);el.remove();};
    root.appendChild(el);
    setTimeout(()=>el.remove(),7000);
  }

  async function poll(){
    if(pollBusy || document.hidden) return;
    pollBusy = true;
    try{
      const before = new Map(latestLeads.map(l => [String(l.id), notificationKey(l)]));
      const r = await fetch(API, {credentials:'same-origin', cache:'no-store'});
      if(r.status === 401){ location.href='/painel/login/?next=/painel/crm/'; return; }
      const d = await r.json();
      if(!r.ok || !Array.isArray(d.leads)) throw new Error(d.error || 'Falha ao atualizar notificações');
      latestLeads = d.leads;
      const seen = readSeen();
      const fresh = notifications().filter(item => !before.has(String(item.lead.id)) && !seen.has(item.key));
      render();
      if(before.size) fresh.slice(0,3).forEach(toast);
      try { if(typeof leads !== 'undefined' && Array.isArray(leads) && leads.length !== latestLeads.length) document.getElementById('refresh')?.click(); } catch {}
    }catch(error){ console.warn('CRM notifications:', error); }
    finally{ pollBusy = false; }
  }

  const style = document.createElement('style');
  style.textContent = `
    :root{--bg:#f4f7fb!important;--card:#fff!important;--line:#dfe6ef!important;--text:#1b2738!important;--muted:#6f7d8f!important;--purple:#6848e8!important;--green:#159b69!important;--red:#d9485f!important;--amber:#b7791f!important;--blue:#2378d4!important;color-scheme:light!important}
    body{background:#f5f7fb!important;color:var(--text)!important}
    .top{background:rgba(255,255,255,.96)!important;border-color:#e2e8f0!important;box-shadow:0 2px 12px rgba(25,39,61,.05)}
    .navlink,.btn{background:#fff!important;color:#344256!important;border-color:#dfe6ef!important}.navlink:hover,.btn:hover{background:#f7f9fc!important}.navlink.active{background:#eeeafd!important;color:#5738d1!important;border-color:#cfc4fb!important}.btn.primary{background:#6848e8!important;color:#fff!important;border-color:#6848e8!important}.btn.whatsapp{background:#eaf8f1!important;color:#137a55!important;border-color:#bfe9d5!important}.btn.danger{background:#fff1f3!important;color:#c7354e!important}
    .field{background:#fff!important;color:#1b2738!important;border-color:#d9e2ec!important}.field:focus{outline:0;border-color:#8d77ef!important;box-shadow:0 0 0 3px rgba(104,72,232,.10)}
    .stat,.card,.crm-exec-card,.crm-exec-panel,.cs-ops-kpis article,.cs-ops-grid article{background:#fff!important;border-color:#e0e7ef!important;box-shadow:0 6px 20px rgba(28,43,64,.04)!important}.col{background:#f8fafc!important;border-color:#e5ebf2!important}.col-head{background:#f7f9fc!important;border-color:#e4eaf1!important}.card:hover{border-color:#b7a9f5!important;box-shadow:0 10px 24px rgba(67,52,121,.08)!important}.card.overdue{border-color:#f0a6b2!important}.score{background:#f1f4f8!important}.pill{background:#eff3f7!important;color:#536174!important}.notice{background:#fff8e8!important;border-color:#f0d38a!important;color:#78540d!important}
    .crm-exec,.cs-ops{background:#f9fbfd!important;border-color:#e1e8f0!important}.crm-exec-row,.cs-ops-row{background:#fff!important;color:#243145!important;border-color:#e0e7ef!important}.crm-source-bar{background:#edf1f6!important}
    .drawer,.modal{background:#fff!important;color:#1b2738!important;border-color:#e1e8f0!important}.overlay,.modal-wrap{background:rgba(25,39,61,.30)!important;backdrop-filter:blur(3px)}.timeline{border-color:#dfe5ec!important}
    .cs-notify-shell{position:relative;display:flex;align-items:center;gap:8px}.cs-notify-button,.cs-human-quick{height:38px;border:1px solid #dfe6ef;background:#fff;color:#344256;border-radius:11px;display:inline-flex;align-items:center;gap:7px;cursor:pointer;position:relative}.cs-notify-button{width:40px;justify-content:center}.cs-human-quick{padding:0 10px;font-size:12px;font-weight:800}.cs-human-quick b{min-width:20px;height:20px;padding:0 5px;border-radius:999px;display:grid;place-items:center;background:#fff0e8;color:#b34b13}.cs-human-dot{width:8px;height:8px;border-radius:50%;background:#f27d3f;box-shadow:0 0 0 4px rgba(242,125,63,.12)}.cs-notify-badge{position:absolute;top:-6px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#dc3e55;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center;border:2px solid #fff}.cs-notify-badge.hidden{display:none}.cs-notify-panel{position:absolute;right:0;top:46px;width:min(390px,calc(100vw - 24px));max-height:520px;overflow:hidden;background:#fff;border:1px solid #dfe6ef;border-radius:16px;box-shadow:0 24px 60px rgba(28,43,64,.18);display:none;z-index:80}.cs-notify-panel.open{display:block}.cs-notify-panel header{padding:14px 15px;border-bottom:1px solid #e7ecf2;display:flex;align-items:center;justify-content:space-between;gap:10px}.cs-notify-panel header>div{display:grid}.cs-notify-panel header span{font-size:11px;color:#7a8797}.cs-notify-panel header button{border:0;background:transparent;color:#6848e8;font-size:11px;font-weight:800;cursor:pointer}.cs-notify-list{max-height:440px;overflow:auto}.cs-notify-item{width:100%;border:0;border-bottom:1px solid #edf1f5;background:#fff;color:#263346;padding:12px 14px;display:grid;grid-template-columns:32px 1fr 8px;gap:9px;text-align:left;cursor:pointer}.cs-notify-item:hover{background:#f8fafc}.cs-notify-item.unread{background:#f6f8ff}.cs-notify-item.human{background:#fff9f5}.cs-notify-item.human.unread{background:#fff2e9}.cs-notify-icon{width:30px;height:30px;border-radius:9px;background:#eef2f8;display:grid;place-items:center}.cs-notify-item.human .cs-notify-icon{background:#ffe7d7}.cs-notify-copy{display:grid;gap:1px}.cs-notify-copy>b{font-size:9px;letter-spacing:.08em;color:#6b5bd2}.cs-notify-item.human .cs-notify-copy>b{color:#bc591d}.cs-notify-copy>strong{font-size:13px}.cs-notify-copy>small,.cs-notify-copy>time{color:#7a8797;font-size:10px}.cs-unread-dot{width:7px;height:7px;border-radius:50%;background:#6848e8;margin-top:5px}.cs-notify-item.human .cs-unread-dot{background:#ef7b3d}.cs-notify-empty{padding:28px;text-align:center;color:#7a8797}
    .cs-human-flag{display:inline-flex;align-items:center;width:max-content;margin:-2px 0 8px;padding:4px 7px;border-radius:999px;background:#fff0e7;color:#b44e17;font-size:9px;font-weight:900;letter-spacing:.05em}.cs-human-card{border-color:#f1b18c!important;box-shadow:inset 3px 0 0 #ef7b3d,0 6px 20px rgba(28,43,64,.04)!important}.cs-human-drawer{margin:12px 0 16px;padding:13px 14px;border:1px solid #f2b78f;background:#fff5ee;border-radius:12px;color:#81401d;display:grid;gap:3px}.cs-human-drawer b{font-size:12px}.cs-human-drawer span{font-size:11px;line-height:1.45}
    #csNotifyToastRoot{position:fixed;right:18px;bottom:72px;z-index:120;display:grid;gap:8px}.cs-notify-toast{min-width:260px;max-width:360px;border:1px solid #dce4ed;background:#fff;color:#263346;border-radius:13px;padding:12px 14px;box-shadow:0 18px 45px rgba(28,43,64,.18);display:grid;gap:2px;text-align:left;cursor:pointer}.cs-notify-toast.human{border-color:#efb38f;background:#fff8f3}.cs-notify-toast b{font-size:12px}.cs-notify-toast span{font-size:11px;color:#738093}
    @media(max-width:850px){.cs-human-quick span:not(.cs-human-dot){display:none}.cs-human-quick{padding:0 8px}.cs-notify-panel{position:fixed;top:70px;right:12px}.top .row{align-items:flex-start}}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(() => decorateHumanLeads());
  window.addEventListener('load', () => {
    ensureUI();
    observer.observe(document.body, {childList:true,subtree:true});
    poll();
    setInterval(poll, POLL_MS);
    setInterval(decorateHumanLeads, 1200);
  });
})();
