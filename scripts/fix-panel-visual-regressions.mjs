import fs from 'node:fs/promises';

const MARKER = 'CS-PANEL-VISUAL-FIX:2026-08-28';

await patchHtml('deploy/painel/prospeccao/index.html', `
<style id="cs-panel-visual-fix-prospeccao">
/* ${MARKER} */
html,body{max-width:100%;overflow-x:hidden}
.step{color:#f5f7fb!important}
.step b{color:#f5f7fb!important;font-weight:800}
.step small{color:#aeb9c9!important}
.step .num{color:#c6dcff!important}
@media(max-width:650px){.step{grid-template-columns:40px minmax(0,1fr)}.step>*{min-width:0}}
</style>`);

await patchHtml('deploy/painel/crm/autonomia/index.html', `
<style id="cs-panel-visual-fix-autonomia">
/* ${MARKER} */
html,body{max-width:100%;overflow-x:hidden}
body.cs-panel-premium .agent,body:has(.cs-sidebar) .agent{color:#f3f6fb!important}
body.cs-panel-premium .agent h3,body:has(.cs-sidebar) .agent h3,
body.cs-panel-premium .agent-work b,body:has(.cs-sidebar) .agent-work b{color:#f3f6fb!important}
body.cs-panel-premium .agent .muted,body:has(.cs-sidebar) .agent .muted,
body.cs-panel-premium .agent-work .muted,body:has(.cs-sidebar) .agent-work .muted{color:#aeb9c9!important}
body.cs-panel-premium .agent-foot,body:has(.cs-sidebar) .agent-foot{color:#9fb0c5!important}
body.cs-panel-premium .agent .pill,body:has(.cs-sidebar) .agent .pill{color:#d5deea!important;background:#171d2b!important;border-color:rgba(255,255,255,.09)!important}
@media(max-width:720px){.layout,.hero,.stats{padding-left:12px!important;padding-right:12px!important}.agent-head{align-items:flex-start}.agent-head h3{min-width:0;overflow-wrap:anywhere}}
</style>`);

await patchWorker();
console.log('Panel visual regressions fixed: explicit dark-card contrast, no horizontal spill and non-overlay admin identity bar.');

async function patchHtml(file, style) {
  let html = await fs.readFile(file, 'utf8');
  if (html.includes(MARKER)) return;
  if (!html.includes('</head>')) throw new Error(`${file}: </head> not found`);
  html = html.replace('</head>', `${style}\n</head>`);
  await fs.writeFile(file, html);
}

async function patchWorker() {
  const file = 'deploy/_worker.js';
  let source = await fs.readFile(file, 'utf8');
  if (source.includes('CS-ADMIN-BAR-NON-OVERLAY:2026-08-28')) return;

  const oldStyle = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#0b1d2d;color:#fff;border:1px solid #31506b;border-radius:999px;padding:9px 13px;font:600 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.25)';
  const newStyle = 'position:relative;z-index:20;margin:18px 14px 14px auto;width:max-content;max-width:calc(100% - 28px);display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;background:#0b1d2d;color:#fff;border:1px solid #31506b;border-radius:18px;padding:9px 13px;font:600 12px/1.35 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.18);overflow-wrap:anywhere';
  if (!source.includes(oldStyle)) throw new Error('deploy/_worker.js: expected fixed admin bar style not found');
  source = source.replace(oldStyle, newStyle);

  const anchor = "async function withPanelIdentity(source,session) {\n  let html=await source.text();";
  if (!source.includes(anchor)) throw new Error('deploy/_worker.js: withPanelIdentity anchor not found');
  source = source.replace(anchor, `${anchor}\n  // CS-ADMIN-BAR-NON-OVERLAY:2026-08-28\n  html=html.replace('</head>','<style id="cs-panel-shell-fix">html,body{max-width:100%;overflow-x:hidden}</style></head>');`);

  await fs.writeFile(file, source);
}
