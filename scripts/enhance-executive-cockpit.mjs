import fs from 'node:fs/promises';
import path from 'node:path';

const PANEL_ROOT = 'deploy/painel';
const EXEC_DIR = path.join(PANEL_ROOT, 'executivo');
const EXEC_FILE = path.join(EXEC_DIR, 'index.html');

await fs.mkdir(EXEC_DIR, { recursive: true });
await fs.writeFile(EXEC_FILE, executiveHtml(), 'utf8');

const htmlFiles = await walkHtml(PANEL_ROOT);
const executiveLink = '<a class="cs-side-link" href="/painel/executivo/" data-cs-section="executivo" data-cs-permission="crm_read"><span class="cs-side-icon">◈</span><span>Executivo</span><span class="cs-action-badge" data-cs-action="executivo"></span></a>';

for (const file of htmlFiles) {
  if (file === EXEC_FILE) continue;
  let html = await fs.readFile(file, 'utf8');
  if (!html.includes('class="cs-side-nav"') || html.includes('href="/painel/executivo/"')) continue;
  html = html.replace('<nav class="cs-side-nav">', `<nav class="cs-side-nav">${executiveLink}`);
  await fs.writeFile(file, html, 'utf8');
}

const generated = await fs.readFile(EXEC_FILE, 'utf8');
for (const needle of ['Cockpit Executivo', '/api/crm/leads?limit=500', '/api/crm/autonomy', 'Próximas melhores ações', 'SLA de primeiro contato']) {
  if (!generated.includes(needle)) throw new Error(`Executive cockpit missing: ${needle}`);
}

console.log(`Executive cockpit ready: ${EXEC_FILE}; menu link injected into ${htmlFiles.length - 1} panel surfaces.`);

async function walkHtml(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function executiveHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Code Solution · Cockpit Executivo</title>
<style>
:root{--bg:#070912;--card:#101623;--card2:#111a2a;--line:rgba(255,255,255,.09);--text:#f4f7fb;--muted:#8f9caf;--purple:#8b5cf6;--blue:#43a8ff;--green:#48d99b;--amber:#ffc966;--red:#ff6f86}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 78% -8%,rgba(139,92,246,.15),transparent 27%),linear-gradient(180deg,#080a14,#070912 42%);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}.top{position:sticky;top:0;z-index:20;background:rgba(7,9,18,.92);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);padding:14px 20px}.nav{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.brand{font-size:18px;font-weight:900;margin-right:auto}.brand b{color:#9b72ff}.nav a,.btn{border:1px solid var(--line);background:#111725;color:var(--text);border-radius:10px;padding:9px 11px;text-decoration:none;font:inherit}.nav a.active{background:#281b44;border-color:#62469b}.btn{cursor:pointer}.wrap{max-width:1540px;margin:0 auto;padding:20px}.head{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px}.head h1{font-size:29px;margin:0}.head p{margin:0;color:var(--muted)}.head-actions{margin-left:auto;display:flex;align-items:center;gap:8px}.live{color:var(--green);font-size:12px}.kpis{display:grid;grid-template-columns:repeat(7,minmax(140px,1fr));gap:11px;margin-bottom:14px}.kpi,.panel{background:linear-gradient(145deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:15px;box-shadow:0 12px 40px rgba(0,0,0,.14)}.kpi{padding:14px}.kpi small{display:block;color:var(--muted)}.kpi strong{display:block;font-size:24px;margin:3px 0}.kpi span{font-size:11px;color:var(--muted)}.kpi.danger strong{color:var(--red)}.kpi.warn strong{color:var(--amber)}.kpi.good strong{color:var(--green)}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-bottom:14px}.panel{padding:16px;overflow:hidden}.panel h2{font-size:16px;margin:0 0 3px}.sub{font-size:12px;color:var(--muted);margin-bottom:13px}.brief{display:grid;gap:9px}.brief-item{padding:12px;border:1px solid var(--line);border-radius:12px;background:#0b111d;display:grid;grid-template-columns:10px 1fr;gap:10px;align-items:start}.dot{width:8px;height:8px;border-radius:50%;margin-top:6px;background:var(--blue)}.dot.red{background:var(--red)}.dot.amber{background:var(--amber)}.dot.green{background:var(--green)}.actions{display:grid;gap:8px}.action{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:12px;background:#0b111d;text-decoration:none}.rank{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#17213a;font-weight:900}.action b{display:block}.action small{color:var(--muted)}.pill{display:inline-flex;padding:4px 8px;border-radius:999px;background:#171e2c;font-size:10px;white-space:nowrap}.pill.red{color:#ff9fac}.pill.amber{color:#ffd48a}.pill.green{color:#8defc4}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse;min-width:820px}.table th{text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px;border-bottom:1px solid var(--line)}.table td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.05)}.empty{padding:22px;text-align:center;color:var(--muted)}.notice{display:none;margin-bottom:14px;padding:12px 14px;border:1px solid rgba(255,111,134,.35);background:rgba(255,111,134,.08);border-radius:12px;color:#ffb7c3}.notice.show{display:block}.money{font-variant-numeric:tabular-nums}.links{display:flex;gap:8px;flex-wrap:wrap}.links a{border:1px solid var(--line);border-radius:9px;padding:8px 10px;text-decoration:none;background:#0b111d;font-size:12px}@media(max-width:1250px){.kpis{grid-template-columns:repeat(4,1fr)}}@media(max-width:980px){.grid{grid-template-columns:1fr}}@media(max-width:680px){.wrap{padding:14px}.kpis{grid-template-columns:repeat(2,1fr)}.head h1{font-size:24px}.head-actions{margin-left:0;width:100%}}
</style>
</head>
<body data-cs-section="executivo">
<header class="top"><nav class="nav"><div class="brand">CODE <b>SOLUTION</b> · EXECUTIVO</div><a href="/painel/">Visão</a><a class="active" href="/painel/executivo/">Executivo</a><a href="/painel/crm/">CRM</a><a href="/painel/crm/autonomia/">Agentes</a><a href="/painel/crm/propostas/">Propostas</a><a href="/painel/marketing/">Marketing</a><a href="/painel/relatorios/saude/">Saúde</a><a href="/painel/logout/">Sair</a></nav></header>
<main class="wrap">
<section class="head"><div><h1>Cockpit Executivo</h1><p>Decisão diária: receita, risco comercial, aprovações e prioridades do Autonomous OS.</p></div><div class="head-actions"><span class="live">● dados do CRM</span><button id="refresh" class="btn">Atualizar</button></div></section>
<div id="notice" class="notice"></div>
<section class="kpis">
<div class="kpi"><small>Pipeline aberto</small><strong id="kPipeline" class="money">R$ 0</strong><span>oportunidades abertas</span></div>
<div class="kpi good"><small>Leads quentes</small><strong id="kHot">0</strong><span>prioridade comercial</span></div>
<div class="kpi danger"><small>SLA de primeiro contato</small><strong id="kSla">0</strong><span>novos há mais de 2h</span></div>
<div class="kpi warn"><small>Follow-ups vencidos</small><strong id="kOverdue">0</strong><span>ação comercial atrasada</span></div>
<div class="kpi warn"><small>Sem próxima ação</small><strong id="kNoAction">0</strong><span>abertos sem data/ação</span></div>
<div class="kpi"><small>Aprovações humanas</small><strong id="kApprovals">0</strong><span>agentes aguardando decisão</span></div>
<div class="kpi"><small>Propostas em aberto</small><strong id="kProposals">0</strong><span>drafts/revisões</span></div>
</section>
<section class="grid"><div class="panel"><h2>Brief executivo automático</h2><div class="sub">Resumo determinístico com base no estado atual do CRM e agentes.</div><div id="brief" class="brief"></div></div><div class="panel"><h2>Próximas melhores ações</h2><div class="sub">Fila priorizada por impacto, urgência e risco de perda.</div><div id="actions" class="actions"></div></div></section>
<section class="grid"><div class="panel"><h2>Oportunidades prioritárias</h2><div class="sub">Leads abertos com maior score, temperatura e urgência.</div><div class="table-wrap"><table class="table"><thead><tr><th>Lead</th><th>Empresa</th><th>Etapa</th><th>Score</th><th>Responsável</th><th>Próxima ação</th><th>Valor</th></tr></thead><tbody id="opps"></tbody></table></div></div><div class="panel"><h2>Decisões & governança</h2><div class="sub">Atalhos para o que exige ação humana.</div><div id="governance" class="brief"></div><div class="links" style="margin-top:12px"><a href="/painel/crm/autonomia/">Abrir Agentes</a><a href="/painel/crm/propostas/">Revisar Propostas</a><a href="/painel/agenda/">Ver Agenda</a><a href="/painel/marketing/">Marketing</a></div></div></section>
</main>
<script>
const API='/api/crm',CLOSED=new Set(['ganho','perdido','arquivado']);let leads=[],autonomy={},proposals=[];const $=id=>document.getElementById(id);const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0));const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dateOf(v){const d=new Date(v||0);return Number.isNaN(d.getTime())?null:d}function ageHours(l){const d=dateOf(l.createdAt||l.created_at);return d?Math.max(0,(Date.now()-d.getTime())/36e5):0}function duePast(l){if(CLOSED.has(l.status)||!l.nextActionDue)return false;const d=dateOf(String(l.nextActionDue).length<=10?l.nextActionDue+'T23:59:59-03:00':l.nextActionDue);return d&&d.getTime()<Date.now()}function noAction(l){return !CLOSED.has(l.status)&&(!l.nextAction||!l.nextActionDue)}function slaBreached(l){return l.status==='novo'&&ageHours(l)>2}function openPipeline(ls){return ls.filter(l=>!CLOSED.has(l.status)).reduce((s,l)=>s+Math.max(0,Number(l.estimatedValue||0)),0)}function priority(l){return Number(slaBreached(l))*4000+Number(duePast(l))*3000+Number(l.temperature==='quente')*2000+Number(noAction(l))*1000+Number(l.score||0)}
async function get(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(r.status===401){location.href='/painel/login/?next=/painel/executivo/';return null}if(!r.ok)throw new Error(url+' retornou HTTP '+r.status);return r.json()}
async function getOptional(url){try{return await get(url)}catch{return null}}
function proposalList(data){if(Array.isArray(data))return data;if(Array.isArray(data?.proposals))return data.proposals;if(Array.isArray(data?.items))return data.items;return []}
function approvalList(data){if(Array.isArray(data?.pendingApprovals))return data.pendingApprovals;if(Array.isArray(data?.approvals))return data.approvals.filter(a=>['pending','pendente','requested'].includes(String(a.status||'').toLowerCase()));return []}
function render(){const open=leads.filter(l=>!CLOSED.has(l.status)),hot=open.filter(l=>l.temperature==='quente'),sla=open.filter(slaBreached),over=open.filter(duePast),noact=open.filter(noAction),approvals=approvalList(autonomy),openProps=proposals.filter(p=>!['approved','rejected','sent','cancelled','archived'].includes(String(p.status||'').toLowerCase()));$('kPipeline').textContent=money(openPipeline(open));$('kHot').textContent=hot.length;$('kSla').textContent=sla.length;$('kOverdue').textContent=over.length;$('kNoAction').textContent=noact.length;$('kApprovals').textContent=approvals.length;$('kProposals').textContent=openProps.length;
 const brief=[];if(sla.length)brief.push(['red',sla.length+' lead'+(sla.length>1?'s':'')+' ultrapassaram o SLA de 2h para primeiro contato.','Abrir Atendimento e tratar antes de novas prospecções.']);else brief.push(['green','SLA de primeiro contato sob controle.','Nenhum lead novo acima de 2 horas.']);if(over.length)brief.push(['amber',over.length+' follow-up'+(over.length>1?'s estão':' está')+' vencido'+(over.length>1?'s':'')+'.','Recuperar conversas com maior score e valor primeiro.']);if(approvals.length)brief.push(['amber',approvals.length+' decisão'+(approvals.length>1?'ões':'')+' aguardando aprovação humana.','Revisar ações externas antes que os agentes avancem.']);if(openProps.length)brief.push(['',openProps.length+' proposta'+(openProps.length>1?'s':'')+' em elaboração/revisão.','Priorizar propostas ligadas a leads quentes e negociação ativa.']);if(!open.length)brief.push(['','Pipeline ainda sem oportunidades abertas.','Executar prospecção orgânica e capturar discovery no CRM.']);$('brief').innerHTML=brief.map(([c,t,s])=>`<div class="brief-item"><i class="dot ${c}"></i><div><b>${esc(t)}</b><div class="sub" style="margin:3px 0 0">${esc(s)}</div></div></div>`).join('');
 const next=[];sla.sort((a,b)=>priority(b)-priority(a)).slice(0,3).forEach(l=>next.push({p:100,label:'SLA',cls:'red',title:'Contatar '+(l.name||l.company||'lead'),sub:'Lead novo há '+Math.floor(ageHours(l))+'h · score '+Number(l.score||0),url:'/painel/atendimento/'}));over.sort((a,b)=>priority(b)-priority(a)).slice(0,3).forEach(l=>next.push({p:90,label:'Follow-up',cls:'amber',title:l.nextAction||('Retomar '+(l.name||l.company||'lead')),sub:(l.company||'')+' · score '+Number(l.score||0),url:'/painel/agenda/'}));if(approvals.length)next.push({p:85,label:'Aprovar',cls:'amber',title:'Revisar '+approvals.length+' decisão(ões) de agentes',sub:'Ações externas permanecem bloqueadas até decisão humana.',url:'/painel/crm/autonomia/'});if(openProps.length)next.push({p:75,label:'Proposta',cls:'',title:'Revisar propostas em aberto',sub:openProps.length+' draft(s) aguardando evolução.',url:'/painel/crm/propostas/'});hot.filter(l=>!slaBreached(l)&&!duePast(l)).sort((a,b)=>priority(b)-priority(a)).slice(0,3).forEach(l=>next.push({p:60,label:'Quente',cls:'green',title:'Avançar '+(l.name||l.company||'oportunidade'),sub:(l.status||'aberto')+' · score '+Number(l.score||0),url:'/painel/crm/?lead='+encodeURIComponent(l.id)}));next.sort((a,b)=>b.p-a.p);$('actions').innerHTML=next.length?next.slice(0,7).map((a,i)=>`<a class="action" href="${a.url}"><span class="rank">${i+1}</span><span><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></span><span class="pill ${a.cls}">${esc(a.label)}</span></a>`).join(''):'<div class="empty">Nenhuma ação crítica identificada agora.</div>';
 const opps=open.slice().sort((a,b)=>priority(b)-priority(a)).slice(0,12);$('opps').innerHTML=opps.length?opps.map(l=>`<tr><td><a href="/painel/crm/?lead=${encodeURIComponent(l.id)}">${esc(l.name||'Lead')}</a></td><td>${esc(l.company||'—')}</td><td>${esc(l.status||'—')}</td><td>${Number(l.score||0)}</td><td>${esc(l.owner||'Sem responsável')}</td><td>${esc(l.nextAction||'Sem próxima ação')}</td><td class="money">${money(l.estimatedValue||0)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nenhuma oportunidade aberta.</td></tr>';
 const gov=[['Aprovações pendentes',approvals.length,approvals.length?'Requerem decisão humana':'Nenhuma decisão bloqueando agentes'],['Propostas abertas',openProps.length,openProps.length?'Revisar escopo, lacunas e draft':'Nenhuma proposta aguardando revisão'],['Leads sem responsável',open.filter(l=>!l.owner).length,'Evite oportunidade sem owner'],['Leads sem próxima ação',noact.length,'Todo lead aberto deve sair com data e ação']];$('governance').innerHTML=gov.map(([t,v,s])=>`<div class="brief-item"><i class="dot ${Number(v)?'amber':'green'}"></i><div><b>${esc(t)}: ${v}</b><div class="sub" style="margin:3px 0 0">${esc(s)}</div></div></div>`).join('')}
async function load(){try{$('notice').className='notice';const [ld,au,pr]=await Promise.all([get(API+'/leads?limit=500'),getOptional(API+'/autonomy'),getOptional(API+'/autonomy/proposals')]);leads=Array.isArray(ld?.leads)?ld.leads:[];autonomy=au||{};proposals=proposalList(pr);render()}catch(e){$('notice').textContent='Não foi possível carregar o cockpit: '+e.message;$('notice').className='notice show'}}$('refresh').onclick=load;load();setInterval(load,120000);
</script>
</body></html>`;
}
