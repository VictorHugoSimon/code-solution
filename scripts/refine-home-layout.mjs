import fs from 'node:fs/promises';

const file = 'deploy/index.html';
const STYLE_ID = 'cs-home-layout-refinement-v2';
const TEMPLATE_RE = /<script type="__bundler\/template">([\s\S]*?)<\/script>/;

const style = `<style id="${STYLE_ID}" data-cs-home-layout-refinement="2">
/* Header: marca legível, navegação com contraste e CTA com hierarquia real */
.cs-premium-public header nav>a>span{color:#172033!important;font-weight:800!important;letter-spacing:-.025em!important}
.cs-premium-public header nav>a>span>span{color:#7c3aed!important}
.cs-premium-public header .nav-links>a:not(:last-child){color:#475467!important;font-weight:650!important;transition:color .18s ease,transform .18s ease!important}
.cs-premium-public header .nav-links>a:not(:last-child):hover{color:#6d3fe9!important;transform:translateY(-1px)!important}
.cs-premium-public header .nav-links>a:last-child{color:#fff!important;background:linear-gradient(135deg,#7446ef 0%,#8b5cf6 52%,#5b7ff2 100%)!important;border:1px solid rgba(109,63,233,.18)!important;border-radius:12px!important;padding:11px 19px!important;box-shadow:0 10px 26px rgba(109,63,233,.22)!important}
.cs-premium-public header .nav-links>a:last-child:hover{box-shadow:0 14px 34px rgba(109,63,233,.30)!important;transform:translateY(-2px)!important}

/* Diferenciais: substituir bloco escuro pesado por cards claros premium */
.cs-premium-public #diferenciais{max-width:1200px!important;margin:0 auto!important;padding:74px 28px 70px!important}
.cs-premium-public #diferenciais>span{display:inline-flex!important;align-items:center!important;gap:8px!important;padding:7px 11px!important;border-radius:999px!important;background:#f1ecff!important;border:1px solid #ddd4ff!important;color:#6d3fe9!important;font-size:11px!important;font-weight:800!important;letter-spacing:.14em!important}
.cs-premium-public #diferenciais>h2{color:#172033!important;font-size:clamp(32px,4vw,50px)!important;line-height:1.04!important;letter-spacing:-.045em!important;max-width:19ch!important;margin:17px 0 16px!important}
.cs-premium-public #diferenciais>p{color:#667085!important;font-size:16.5px!important;line-height:1.65!important;max-width:64ch!important;margin-bottom:34px!important}
.cs-premium-public #diferenciais>div{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:16px!important;background:transparent!important;border:0!important;border-radius:0!important;overflow:visible!important}
.cs-premium-public #diferenciais>div>div,.cs-premium-public #diferenciais>div>sc-for>div{position:relative!important;overflow:hidden!important;background:linear-gradient(145deg,#ffffff 0%,#fbfaff 100%)!important;border:1px solid #e8e3f1!important;border-radius:20px!important;padding:25px!important;min-height:210px!important;box-shadow:0 12px 34px rgba(32,41,68,.065)!important;transition:transform .24s ease,box-shadow .24s ease,border-color .24s ease!important}
.cs-premium-public #diferenciais>div>div:before,.cs-premium-public #diferenciais>div>sc-for>div:before{content:""!important;position:absolute!important;right:-42px!important;top:-46px!important;width:118px!important;height:118px!important;border-radius:50%!important;background:radial-gradient(circle,rgba(124,58,237,.11),transparent 70%)!important;pointer-events:none!important}
.cs-premium-public #diferenciais>div>div:hover,.cs-premium-public #diferenciais>div>sc-for>div:hover{transform:translateY(-5px)!important;border-color:#d6c9fb!important;box-shadow:0 20px 48px rgba(67,54,121,.11)!important}
.cs-premium-public #diferenciais>div>div>div:first-child,.cs-premium-public #diferenciais>div>sc-for>div>div:first-child{width:44px!important;height:44px!important;border-radius:13px!important;background:linear-gradient(145deg,#f5f0ff,#eee8ff)!important;border:1px solid #ddd2ff!important;color:#7141ea!important;margin-bottom:19px!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.7)!important}
.cs-premium-public #diferenciais h3{color:#1b2638!important;font-size:18px!important;font-weight:750!important;line-height:1.25!important;letter-spacing:-.02em!important;margin-bottom:9px!important}
.cs-premium-public #diferenciais p{color:#667085!important;font-size:14.5px!important;line-height:1.65!important}

/* Footer: preservar legibilidade da marca sobre o tema claro */
.cs-premium-public footer .footer-grid>div:first-child>div>span{color:#172033!important}
.cs-premium-public footer .footer-grid>div:first-child>div>span>span{color:#7c3aed!important}

@media(max-width:980px){
  .cs-premium-public #diferenciais>div{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .cs-premium-public header .nav-links{gap:18px!important}
}
@media(max-width:760px){
  .cs-premium-public #diferenciais{padding:54px 18px 52px!important}
  .cs-premium-public #diferenciais>div{grid-template-columns:1fr!important;gap:12px!important}
  .cs-premium-public #diferenciais>div>div,.cs-premium-public #diferenciais>div>sc-for>div{min-height:0!important;padding:22px!important}
}
</style>`;

function strip(markup){
  return markup.replace(new RegExp(`<style id=["']${STYLE_ID}["'][\\s\\S]*?<\\/style>`, 'gi'), '');
}
function inject(markup){
  const clean = strip(markup);
  return /<\/head>/i.test(clean) ? clean.replace(/<\/head>/i, `${style}\n</head>`) : `${style}\n${clean}`;
}
function encode(value){
  return JSON.stringify(value).replace(/<\/script/gi,'<\\/script');
}

const before = await fs.readFile(file, 'utf8');
const match = before.match(TEMPLATE_RE);
let after;
if (!match) {
  after = inject(before);
} else {
  const template = JSON.parse(match[1]);
  const inner = inject(template);
  const outer = inject(before);
  after = outer.replace(TEMPLATE_RE, `<script type="__bundler/template">${encode(inner)}</script>`);
}

await fs.writeFile(file, after);
if (!after.includes('data-cs-home-layout-refinement="2"')) throw new Error('Refinamento visual da Home não foi aplicado');
console.log('Refinamento visual premium da Home aplicado.');
