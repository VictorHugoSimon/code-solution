import fs from 'node:fs/promises';
import path from 'node:path';

const PANEL_ROOT = path.resolve('deploy/painel');
const STYLE_ID = 'cs-panel-accessibility-theme';

const style = `<style id="${STYLE_ID}" data-cs-panel-accessibility-theme="1">
/* Code Solution Panel — contraste operacional / navegação */
:root{
  --cs-ui-bg:#eef2f7;
  --cs-ui-surface:#ffffff;
  --cs-ui-surface-2:#f8fafc;
  --cs-ui-surface-3:#f1f5f9;
  --cs-ui-line:#cbd5e1;
  --cs-ui-line-strong:#aeb9c8;
  --cs-ui-text:#0f172a;
  --cs-ui-muted:#475569;
  --cs-ui-muted-2:#64748b;
  --cs-ui-navy:#0b1220;
  --cs-ui-navy-2:#111b2e;
  --cs-ui-violet:#6447e8;
  --cs-ui-violet-2:#7c5cf4;
  --cs-ui-blue:#2563eb;
  --cs-ui-cyan:#0f8fa8;
  --cs-ui-green:#087a55;
  --cs-ui-amber:#9a5b06;
  --cs-ui-red:#b4233c;
  --cs-ui-shadow:0 8px 24px rgba(15,23,42,.08);
  --cs-side-w:276px;
}

body.cs-panel-premium,
body:has(.cs-sidebar){
  background:var(--cs-ui-bg)!important;
  color:var(--cs-ui-text)!important;
}

/* Sidebar nova e sidebar legada: sempre escura e com contraste forte */
.cs-sidebar,
.cs-app-sidebar{
  width:276px!important;
  background:linear-gradient(180deg,#0a1220 0%,#0d1728 52%,#101b2d 100%)!important;
  border-right:1px solid rgba(255,255,255,.08)!important;
  color:#f8fafc!important;
  box-shadow:12px 0 34px rgba(15,23,42,.16)!important;
}
body:has(.cs-sidebar){padding-left:276px!important}
body.cs-panel-premium{--sidebar:276px!important;padding-left:276px!important}

.cs-side-brand,
.cs-app-sidebar .cs-side-brand{
  color:#f8fafc!important;
  font-weight:900!important;
  letter-spacing:.01em!important;
}
.cs-side-brand b,
.cs-app-sidebar .cs-side-brand b{color:#a78bfa!important}
.cs-side-brand small,
.cs-side-label,
.cs-side-status{color:#a7b4c7!important}

.cs-side-head{gap:10px!important;padding:0 14px 14px!important}
.cs-human-summary,.cs-bell{
  background:#152238!important;
  border-color:#2b3b52!important;
  color:#f8fafc!important;
  box-shadow:none!important;
}
.cs-human-summary{font-size:12px!important;min-height:46px!important;padding:10px 12px!important}
.cs-bell{min-width:46px!important;min-height:46px!important}

.cs-side-nav{padding:4px 12px 16px!important;gap:5px!important}
.cs-side-link{
  min-height:44px!important;
  padding:10px 12px!important;
  border-radius:11px!important;
  color:#d6deea!important;
  font-size:13px!important;
  font-weight:700!important;
  border:1px solid transparent!important;
  transition:background .16s ease,color .16s ease,border-color .16s ease,transform .16s ease!important;
}
.cs-side-link:hover{
  background:#18263b!important;
  color:#fff!important;
  border-color:#30435d!important;
  transform:translateX(2px)!important;
}
.cs-side-link.active{
  background:linear-gradient(135deg,#5d43d8 0%,#6d50ec 58%,#365dcf 100%)!important;
  color:#fff!important;
  border-color:#8d79ef!important;
  box-shadow:0 8px 18px rgba(79,70,229,.28)!important;
}
.cs-side-icon{color:#9fb0c6!important;font-size:16px!important}
.cs-side-link.active .cs-side-icon{color:#fff!important}
.cs-action-badge{
  background:#fee2e2!important;
  border-color:#fecaca!important;
  color:#991b1b!important;
}

.cs-side-quick{padding:12px!important;border-top-color:#26364d!important}
.cs-side-newlead{
  min-height:44px!important;
  background:linear-gradient(135deg,#6d45e8,#7c55ef)!important;
  color:#fff!important;
  font-size:13px!important;
  box-shadow:0 8px 18px rgba(109,69,232,.24)!important;
}
.cs-side-exit{
  min-height:42px!important;
  background:#111d30!important;
  border-color:#2a3b53!important;
  color:#d8e1ec!important;
  font-weight:700!important;
}
.cs-side-exit:hover{background:#1b2a40!important;color:#fff!important}

/* Área principal */
.cs-panel-premium .top,
body:has(.cs-sidebar) .top{
  background:rgba(255,255,255,.96)!important;
  border-bottom:1px solid var(--cs-ui-line)!important;
  box-shadow:0 5px 18px rgba(15,23,42,.05)!important;
}
.cs-panel-premium .wrap{max-width:1600px!important;padding:24px 26px 40px!important}

.cs-panel-premium h1,
.cs-panel-premium h2,
.cs-panel-premium h3,
body:has(.cs-sidebar) h1,
body:has(.cs-sidebar) h2,
body:has(.cs-sidebar) h3{color:var(--cs-ui-text)!important}

.cs-panel-premium .kpi,
.cs-panel-premium .stat,
.cs-panel-premium .panel,
.cs-panel-premium .module,
.cs-panel-premium .col,
.cs-panel-premium .card,
.cs-panel-premium .temp,
body:has(.cs-sidebar) .kpi,
body:has(.cs-sidebar) .stat,
body:has(.cs-sidebar) .panel,
body:has(.cs-sidebar) .module,
body:has(.cs-sidebar) .col,
body:has(.cs-sidebar) .card{
  background:var(--cs-ui-surface)!important;
  color:var(--cs-ui-text)!important;
  border-color:#d6dee8!important;
  box-shadow:var(--cs-ui-shadow)!important;
}
.cs-panel-premium .kpi,.cs-panel-premium .stat,
body:has(.cs-sidebar) .kpi,body:has(.cs-sidebar) .stat{
  border-radius:14px!important;
}
.cs-panel-premium .kpi:before,.cs-panel-premium .stat:before,
body:has(.cs-sidebar) .kpi:before,body:has(.cs-sidebar) .stat:before{
  width:4px!important;
  background:linear-gradient(180deg,#6046e5,#3183e5)!important;
}

.cs-panel-premium .kpi small,.cs-panel-premium .kpi span,
.cs-panel-premium .stat small,.cs-panel-premium .sub,.cs-panel-premium .meta,
body:has(.cs-sidebar) .kpi small,body:has(.cs-sidebar) .kpi span,
body:has(.cs-sidebar) .stat small,body:has(.cs-sidebar) .sub,body:has(.cs-sidebar) .meta{
  color:var(--cs-ui-muted)!important;
}
.cs-panel-premium .kpi strong,.cs-panel-premium .stat strong,
body:has(.cs-sidebar) .kpi strong,body:has(.cs-sidebar) .stat strong{
  color:#111827!important;
  font-weight:850!important;
}

/* Formulários e filtros */
.cs-panel-premium input,.cs-panel-premium select,.cs-panel-premium textarea,
.cs-panel-premium .field,.cs-panel-premium .select,
body:has(.cs-sidebar) input,body:has(.cs-sidebar) select,body:has(.cs-sidebar) textarea,
body:has(.cs-sidebar) .field{
  background:#fff!important;
  color:#172033!important;
  border:1px solid var(--cs-ui-line-strong)!important;
  box-shadow:0 1px 2px rgba(15,23,42,.03)!important;
}
.cs-panel-premium input::placeholder,.cs-panel-premium textarea::placeholder,
body:has(.cs-sidebar) input::placeholder,body:has(.cs-sidebar) textarea::placeholder{
  color:#667085!important;
  opacity:1!important;
}
.cs-panel-premium input:focus,.cs-panel-premium select:focus,.cs-panel-premium textarea:focus,
body:has(.cs-sidebar) input:focus,body:has(.cs-sidebar) select:focus,body:has(.cs-sidebar) textarea:focus{
  outline:3px solid rgba(100,71,232,.14)!important;
  border-color:#7358e8!important;
}

/* Botões */
.cs-panel-premium .btn,
.cs-panel-premium .mini,
body:has(.cs-sidebar) .btn,
body:has(.cs-sidebar) .mini{
  color:#172033!important;
  background:#fff!important;
  border:1px solid #aeb9c8!important;
  font-weight:750!important;
}
.cs-panel-premium .btn:hover,.cs-panel-premium .mini:hover,
body:has(.cs-sidebar) .btn:hover,body:has(.cs-sidebar) .mini:hover{
  background:#eef2ff!important;
  border-color:#7c67dc!important;
  color:#33246f!important;
}
.cs-panel-premium .btn.primary,.cs-panel-premium .mini.primary,
body:has(.cs-sidebar) .btn.primary,body:has(.cs-sidebar) .mini.primary{
  background:#244f88!important;
  border-color:#244f88!important;
  color:#fff!important;
}
.cs-panel-premium .mini.good,body:has(.cs-sidebar) .mini.good{
  background:#0b6b4e!important;
  border-color:#0b6b4e!important;
  color:#fff!important;
}
.cs-panel-premium .mini.danger,body:has(.cs-sidebar) .mini.danger,
.cs-panel-premium .btn.danger,body:has(.cs-sidebar) .btn.danger{
  background:#9f2940!important;
  border-color:#9f2940!important;
  color:#fff!important;
}
.cs-panel-premium .btn.whatsapp,body:has(.cs-sidebar) .btn.whatsapp{
  background:#087a55!important;
  border-color:#087a55!important;
  color:#fff!important;
}

/* Tabelas */
.cs-panel-premium .table-wrap,
body:has(.cs-sidebar) .table-wrap{
  border:1px solid #d6dee8!important;
  border-radius:12px!important;
  background:#fff!important;
}
.cs-panel-premium table,body:has(.cs-sidebar) table{background:#fff!important}
.cs-panel-premium th,body:has(.cs-sidebar) th{
  background:#e8edf4!important;
  color:#334155!important;
  border-bottom:1px solid #cbd5e1!important;
  font-weight:850!important;
}
.cs-panel-premium td,body:has(.cs-sidebar) td{
  background:#fff!important;
  color:#1e293b!important;
  border-bottom-color:#e2e8f0!important;
}
.cs-panel-premium tbody tr:nth-child(even) td,
body:has(.cs-sidebar) tbody tr:nth-child(even) td{background:#f8fafc!important}
.cs-panel-premium tbody tr:hover td,
body:has(.cs-sidebar) tbody tr:hover td{background:#eef2ff!important}

/* Textos específicos do Growth / CRM */
.cs-panel-premium .message,body:has(.cs-sidebar) .message{color:#334155!important}
.cs-panel-premium .source,body:has(.cs-sidebar) .source{color:#075ea8!important;font-weight:700!important}
.cs-panel-premium .score.hot,body:has(.cs-sidebar) .score.hot{color:#087a55!important}
.cs-panel-premium .score.warm,body:has(.cs-sidebar) .score.warm{color:#8a4b00!important}
.cs-panel-premium .score.cold,body:has(.cs-sidebar) .score.cold{color:#475569!important}
.cs-panel-premium .pill,body:has(.cs-sidebar) .pill{
  background:#e9eef5!important;
  color:#334155!important;
  border:1px solid #d5dde7!important;
  font-weight:700!important;
}
.cs-panel-premium .pill.high,body:has(.cs-sidebar) .pill.high{
  background:#dcfce7!important;color:#166534!important;border-color:#bbf7d0!important;
}
.cs-panel-premium .pill.medium,body:has(.cs-sidebar) .pill.medium{
  background:#fef3c7!important;color:#92400e!important;border-color:#fde68a!important;
}

/* CRM board */
.cs-panel-premium .col,body:has(.cs-sidebar) .col{background:#f4f7fb!important}
.cs-panel-premium .col-head,body:has(.cs-sidebar) .col-head{
  background:#e9eef5!important;
  color:#1e293b!important;
  border-bottom-color:#cdd6e1!important;
  font-weight:800!important;
}
.cs-panel-premium .card,body:has(.cs-sidebar) .card{
  border-color:#cfd8e4!important;
}
.cs-panel-premium .card:hover,body:has(.cs-sidebar) .card:hover{
  border-color:#7c67dc!important;
  box-shadow:0 10px 24px rgba(65,53,137,.12)!important;
}

/* Notificações */
.cs-notification-pop{
  background:#111c2e!important;
  color:#f8fafc!important;
  border-color:#34455d!important;
}
.cs-notif-item{background:#18263b!important;color:#f1f5f9!important;border-color:#30435d!important}
.cs-notif-item small,.cs-notif-empty{color:#aab8ca!important}

/* Barra inferior de sessão/admin */
.cs-admin-session-bar,
[class*="admin-session"],
[class*="session-bar"]{
  background:#0b1728!important;
  color:#f8fafc!important;
  border:1px solid #2d4058!important;
  box-shadow:0 8px 28px rgba(15,23,42,.22)!important;
}

@media(max-width:1120px){
  :root{--cs-side-w:252px}
  .cs-sidebar,.cs-app-sidebar{width:252px!important}
  body:has(.cs-sidebar),body.cs-panel-premium{padding-left:252px!important}
}
@media(max-width:900px){
  body:has(.cs-sidebar),body.cs-panel-premium{padding-left:0!important}
  .cs-sidebar,.cs-app-sidebar{width:min(300px,88vw)!important}
}
</style>`;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function stripExisting(html) {
  const re = new RegExp(`<style id=["']${STYLE_ID}["'][\\s\\S]*?<\\/style>`, 'gi');
  return html.replace(re, '');
}

const files = await walk(PANEL_ROOT);
for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  html = stripExisting(html);
  if (!html.includes('</head>')) continue;
  html = html.replace('</head>', `${style}\n</head>`);
  await fs.writeFile(file, html);
}

console.log(`Applied high-contrast Code Solution panel theme to ${files.length} HTML surfaces.`);
