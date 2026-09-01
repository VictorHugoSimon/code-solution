(() => {
  const API = '/api/crm';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const pct = (value) => value == null || !Number.isFinite(Number(value)) ? '—' : `${Math.max(0, Math.round(Number(value)))}%`;
  const channelLabel = (value) => ({
    linkedin: 'LinkedIn', prospeccao_ativa: 'Prospecção ativa', indicacao: 'Indicação', whatsapp: 'WhatsApp',
    site: 'Site', google: 'Google', instagram: 'Instagram', facebook: 'Facebook', email: 'E-mail', direto: 'Direto',
  }[String(value || '').toLowerCase()] || String(value || 'Canal').replace(/_/g, ' '));

  async function loadGoals() {
    const response = await fetch(`${API}/acquisition/goals?days=7`, { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) {
      location.href = '/painel/login/?next=/painel/executivo/';
      return null;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function progressClass(value) {
    if (value == null) return '';
    if (value >= 100) return 'green';
    if (value >= 60) return 'amber';
    return 'red';
  }

  function metric(label, actual, goal, progress) {
    const goalText = Number(goal || 0) > 0 ? `${Number(actual || 0)} / ${Number(goal || 0)}` : `${Number(actual || 0)} / sem meta`;
    return `<div class="cs-goal-metric"><span>${esc(label)}</span><strong>${esc(goalText)}</strong><small class="${progressClass(progress)}">${esc(pct(progress))}</small></div>`;
  }

  function recommendation(goals) {
    const configured = goals.filter((g) => g.active && g.configured);
    const candidates = configured.map((g) => {
      const leadGoal = Number(g.goals?.leads || 0);
      const leadActual = Number(g.actual?.leads || 0);
      const sessionGoal = Number(g.goals?.sessions || 0);
      const sessionActual = Number(g.actual?.sessions || 0);
      const winGoal = Number(g.goals?.wins || 0);
      const winActual = Number(g.actual?.wins || 0);
      const leadGap = leadGoal > 0 ? Math.max(0, leadGoal - leadActual) / leadGoal : 0;
      const sessionGap = sessionGoal > 0 ? Math.max(0, sessionGoal - sessionActual) / sessionGoal : 0;
      const winGap = winGoal > 0 ? Math.max(0, winGoal - winActual) / winGoal : 0;
      return { g, severity: leadGap * 3 + winGap * 2 + sessionGap };
    }).sort((a, b) => b.severity - a.severity);

    if (!candidates.length) return 'Configure metas de aquisição para habilitar recomendações Meta x Realizado.';
    const top = candidates[0];
    if (top.severity <= 0) return 'As metas configuradas para a janela estão atendidas; preserve o ritmo e acompanhe qualidade/conversão.';
    const g = top.g;
    const channel = channelLabel(g.channel);
    const leadGoal = Number(g.goals?.leads || 0), leadActual = Number(g.actual?.leads || 0);
    const sessionGoal = Number(g.goals?.sessions || 0), sessionActual = Number(g.actual?.sessions || 0);
    if (leadGoal > leadActual) return `Prioridade: ${channel}. Faltam ${leadGoal - leadActual} lead(s) para a meta semanal; aumente ações com CTA e follow-up rastreável neste canal.`;
    if (sessionGoal > sessionActual) return `Prioridade: ${channel}. Faltam ${sessionGoal - sessionActual} sessão(ões) para a meta semanal; aumente distribuição e alcance antes de mudar a oferta.`;
    return `Prioridade: ${channel}. Revise conversão e avanço até ganho antes de ampliar volume.`;
  }

  function render(data) {
    const goals = Array.isArray(data?.goals) ? data.goals.filter((g) => g.active && g.configured) : [];
    const main = document.querySelector('main.wrap');
    if (!main || document.getElementById('cs-executive-goals')) return;

    const section = document.createElement('section');
    section.id = 'cs-executive-goals';
    section.className = 'panel cs-goals-panel';
    section.innerHTML = `
      <div class="cs-goals-head">
        <div><h2>Meta x Realizado · Aquisição</h2><div class="sub">Janela de ${Number(data?.days || 7)} dias. Metas operacionais configuradas no CRM, não projeções.</div></div>
        <span class="tag">Atualizado agora</span>
      </div>
      <div class="cs-goals-grid">
        ${goals.map((g) => `<article class="item cs-goal-card">
          <b>${esc(channelLabel(g.channel))}</b>
          <div class="cs-goal-metrics">
            ${metric('Sessões', g.actual?.sessions, g.goals?.sessions, g.progress?.sessions)}
            ${metric('Leads', g.actual?.leads, g.goals?.leads, g.progress?.leads)}
            ${metric('Ganhos', g.actual?.wins, g.goals?.wins, g.progress?.wins)}
          </div>
        </article>`).join('') || '<div class="empty">Nenhuma meta ativa configurada.</div>'}
      </div>
      <div class="item cs-goal-recommendation"><b>Próxima melhor ação de aquisição</b><small>${esc(recommendation(goals))}</small></div>`;

    const firstGrid = main.querySelector('.grid');
    if (firstGrid) main.insertBefore(section, firstGrid);
    else main.appendChild(section);

    const style = document.createElement('style');
    style.textContent = `.cs-goals-panel{margin-bottom:14px}.cs-goals-head{display:flex;align-items:flex-start;gap:12px;justify-content:space-between;margin-bottom:12px}.cs-goals-grid{display:grid;grid-template-columns:repeat(5,minmax(180px,1fr));gap:9px}.cs-goal-card>b{text-transform:capitalize}.cs-goal-metrics{display:grid;gap:6px;margin-top:9px}.cs-goal-metric{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;font-size:12px}.cs-goal-metric span{color:var(--muted)}.cs-goal-metric small{min-width:44px;text-align:right;color:var(--muted)}.cs-goal-metric small.green{color:var(--green)}.cs-goal-metric small.amber{color:var(--amber)}.cs-goal-metric small.red{color:var(--red)}.cs-goal-recommendation{margin-top:10px;border-color:rgba(66,167,255,.28)}@media(max-width:1240px){.cs-goals-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.cs-goals-grid{grid-template-columns:1fr}.cs-goals-head{display:block}.cs-goals-head .tag{margin-top:8px}}`;
    document.head.appendChild(style);
  }

  loadGoals().then((data) => data && render(data)).catch((error) => {
    console.warn('Executive acquisition goals unavailable:', error?.message || error);
  });
})();
