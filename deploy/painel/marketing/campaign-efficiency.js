(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>`${Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;

  function ensure(){
    if(document.getElementById('csCampaignEfficiency')) return;
    const campaignBody=document.getElementById('campaigns');
    const campaignPanel=campaignBody?.closest('.panel');
    if(!campaignPanel) return;
    const section=document.createElement('section');
    section.id='csCampaignEfficiency';
    section.className='panel';
    section.style.marginTop='14px';
    section.innerHTML=`
      <h2>Ranking de eficiência comercial</h2>
      <div class="sub">Campanhas orgânicas ordenadas por qualidade e avanço comercial, sem fingir CAC/ROAS quando não há custo de mídia integrado.</div>
      <div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Campanha</th><th>Leads</th><th>Quentes</th><th>Ganhos</th><th>Score médio</th><th>Eficiência</th></tr></thead><tbody id="campaignEfficiencyRows"></tbody></table></div>
      <div class="cs-eff-note">Índice = 50% conversão Lead→Ganho + 30% proporção de leads quentes + 20% score médio. Use como prioridade comercial; não representa retorno financeiro de mídia.</div>`;
    campaignPanel.insertAdjacentElement('afterend',section);
    const style=document.createElement('style');
    style.textContent=`.cs-eff-note{margin-top:10px;color:var(--muted);font-size:11px}.cs-eff{font-weight:900}.cs-eff.high{color:var(--green)}.cs-eff.mid{color:var(--amber)}.cs-rank{display:inline-grid;place-items:center;min-width:27px;height:27px;border-radius:999px;background:#171d2c;font-weight:900}.cs-rank.top{background:rgba(72,217,155,.13);color:var(--green);border:1px solid rgba(72,217,155,.22)}`;
    document.head.appendChild(style);
  }

  function currentLeads(){
    try {
      if(typeof periodLeads==='function') return periodLeads();
      if(typeof allLeads!=='undefined' && Array.isArray(allLeads)) return allLeads;
    } catch {}
    return [];
  }

  function compute(){
    ensure();
    const body=document.getElementById('campaignEfficiencyRows');
    if(!body) return;
    const leads=currentLeads();
    const groups=new Map();
    for(const lead of leads){
      const campaign=String(lead.campaign||'').trim();
      if(!campaign) continue;
      if(!groups.has(campaign)) groups.set(campaign,[]);
      groups.get(campaign).push(lead);
    }
    const rows=[...groups.entries()].map(([campaign,arr])=>{
      const total=arr.length;
      const hot=arr.filter(x=>x.temperature==='quente').length;
      const wins=arr.filter(x=>x.status==='ganho').length;
      const avgScore=total?arr.reduce((sum,x)=>sum+Math.max(0,Math.min(100,Number(x.score||0))),0)/total:0;
      const hotRate=total?(hot/total)*100:0;
      const winRate=total?(wins/total)*100:0;
      const efficiency=(winRate*.5)+(hotRate*.3)+(avgScore*.2);
      return {campaign,total,hot,wins,avgScore,hotRate,winRate,efficiency};
    }).sort((a,b)=>b.efficiency-a.efficiency || b.wins-a.wins || b.total-a.total || a.campaign.localeCompare(b.campaign,'pt-BR'));

    body.innerHTML=rows.length?rows.slice(0,30).map((x,i)=>`<tr><td><span class="cs-rank ${i<3?'top':''}">${i+1}</span></td><td><b>${esc(x.campaign)}</b></td><td>${x.total}</td><td>${x.hot} <span class="cs-eff-note">(${pct(x.hotRate)})</span></td><td>${x.wins} <span class="cs-eff-note">(${pct(x.winRate)})</span></td><td>${Math.round(x.avgScore)}</td><td><span class="cs-eff ${x.efficiency>=60?'high':x.efficiency>=35?'mid':''}">${x.efficiency.toLocaleString('pt-BR',{maximumFractionDigits:1})}</span></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Ainda não há campanhas com UTM suficiente para gerar ranking.</td></tr>';
  }

  function bind(){
    ensure();
    const campaigns=document.getElementById('campaigns');
    if(campaigns){
      const observer=new MutationObserver(()=>compute());
      observer.observe(campaigns,{childList:true,subtree:true});
    }
    document.getElementById('period')?.addEventListener('change',()=>setTimeout(compute,80));
    document.getElementById('refresh')?.addEventListener('click',()=>setTimeout(compute,500));
    setTimeout(compute,900);
    setTimeout(compute,1800);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
