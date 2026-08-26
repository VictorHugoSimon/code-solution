import fs from 'node:fs/promises';
import path from 'node:path';

const deployRoot = path.resolve('deploy');
const STYLE_ID = 'cs-clean-ui';
const HOME_SCRIPT_ID = 'cs-clean-home-runtime';
const TEMPLATE_RE = /<script type="__bundler\/template">([\s\S]*?)<\/script>/;

const cleanStyle = `<style id="${STYLE_ID}" data-cs-clean-ui="1">
:root{
  color-scheme:light;
  --bg:#f7f8fb!important;--bg2:#ffffff!important;--panel:#ffffff!important;--card:#ffffff!important;
  --surface:#ffffff!important;--surface-2:#f8fafc!important;--line:#e5e7eb!important;
  --text:#172033!important;--muted:#667085!important;--purple:#6f3de8!important;--lilac:#8b5cf6!important;
  --cs-bg:#f7f8fb!important;--cs-card:#ffffff!important;--cs-line:#e5e7eb!important;--cs-text:#172033!important;
  --cs-muted:#667085!important;--cs-purple:#6f3de8!important;--cs-lilac:#7c3aed!important;--cs-green:#18864b!important;--cs-red:#c9364f!important;
}
html,body{background:#f7f8fb!important;color:#172033!important;background-image:none!important}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;line-height:1.5!important}
body::before,body::after{filter:none!important;opacity:.16!important}
#__bundler_thumbnail{background:#f7f8fb!important}
#__bundler_thumbnail svg rect:first-child{fill:#f7f8fb!important}
#__bundler_thumbnail svg text{fill:#172033!important}
#__bundler_loading{color:#667085!important;background:#fff!important;border:1px solid #e5e7eb!important;box-shadow:0 8px 24px rgba(15,23,42,.08)!important}
h1,h2,h3,h4,h5,h6{color:#172033!important;letter-spacing:-.025em!important}
p,li,dd,.muted,.subtitle,.description,[class*="muted"]{color:#667085!important}
a{color:#6f3de8}
header,.top,.topbar,[class*="topbar"],[class*="header"],nav,[class*="nav"]{border-color:#e5e7eb!important}
header,.top,.topbar,[class*="topbar"]{background:rgba(255,255,255,.94)!important;backdrop-filter:blur(14px)!important}
main,[class*="content"],[class*="workspace"]{background-color:transparent!important}
aside,.sidebar,[class*="sidebar"],[class*="sidenav"]{background:#fff!important;border-color:#e5e7eb!important}
[class*="card"],[class*="panel"],[class*="module"],[class*="widget"],[class*="kpi"],[class*="metric"],[class*="tile"],[class*="surface"]{
  background:#fff!important;border-color:#e5e7eb!important;box-shadow:0 8px 24px rgba(15,23,42,.055)!important;
}
[class*="card"]::before,[class*="panel"]::before,[class*="module"]::before{opacity:.12!important}
input,textarea,select{background:#fff!important;color:#172033!important;border-color:#d8dee8!important;box-shadow:none!important}
input:focus,textarea:focus,select:focus{border-color:#7c3aed!important;box-shadow:0 0 0 3px rgba(124,58,237,.10)!important;outline:none!important}
table{background:#fff!important;border-color:#e5e7eb!important}
th{background:#f8fafc!important;color:#475467!important;border-color:#e5e7eb!important}
td{background:#fff!important;color:#344054!important;border-color:#eef0f4!important}
hr{border-color:#e5e7eb!important}
button,.cs-btn,[class*="btn-primary"],[class*="button-primary"]{border-radius:10px!important;box-shadow:none!important}
.cs-btn:not(.alt),button[type="submit"]{background:#6f3de8!important;color:#fff!important;border-color:#6f3de8!important}
.cs-btn.alt{background:#fff!important;color:#5b2ec7!important;border:1px solid #ddd6fe!important}
.cs-kicker{color:#6f3de8!important}
.cs-extension{background:#f7f8fb!important;color:#172033!important;padding:48px max(22px,calc((100% - 1120px)/2))!important}
.cs-extension h2{font-size:clamp(28px,3.2vw,42px)!important;max-width:25ch!important}
.cs-extension .cs-intro{font-size:16px!important;line-height:1.55!important;max-width:700px!important}
.cs-extension .cs-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;margin-top:20px!important}
.cs-extension .cs-card{padding:18px!important;border-radius:14px!important}
.cs-extension .cs-card h3{font-size:16px!important;margin-bottom:6px!important}
.cs-extension .cs-actions{margin-top:18px!important}
.cs-lead,.cs-journey{margin-top:30px!important;padding:24px!important;border-radius:18px!important;background:#fff!important;border:1px solid #e5e7eb!important;box-shadow:0 10px 28px rgba(15,23,42,.055)!important}
.cs-progress{margin:16px 0 20px!important}.cs-progress span{background:#e9e5f5!important}.cs-progress span.on{background:#6f3de8!important}
.cs-options{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin-top:14px!important}
.cs-option,.cs-next,.cs-protocol{background:#f8fafc!important;border-color:#e5e7eb!important;padding:12px!important}
.cs-option:has(input:checked){background:#f3efff!important;border-color:#8b5cf6!important;box-shadow:0 0 0 2px rgba(124,58,237,.08)!important}
.cs-step h3{font-size:19px!important}.cs-step-actions{margin-top:16px!important}
.cs-success{background:#f4fbf7!important;border-color:#bfe8cf!important}.cs-success-badge{color:#18864b!important;background:#e9f8ef!important}
.cs-route{background:#f7f4ff!important;border-color:#ddd6fe!important}
.cs-faq{margin-top:30px!important}.cs-faq h2{margin-bottom:14px!important}
.cs-clean-details{border:1px solid #e5e7eb;border-radius:14px;background:#fff;overflow:hidden}
.cs-clean-details>summary{cursor:pointer;list-style:none;padding:16px 18px;font-weight:800;color:#5b2ec7;display:flex;align-items:center;justify-content:space-between}
.cs-clean-details>summary::-webkit-details-marker{display:none}.cs-clean-details>summary::after{content:"+";font-size:21px;font-weight:500}.cs-clean-details[open]>summary::after{content:"–"}
.cs-clean-details .cs-faq-grid{padding:0 16px 16px!important;margin-top:0!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
.cs-clean-home-optional{display:none!important}
.cs-clean-home main section,.cs-clean-home main>div{scroll-margin-top:84px}
.cs-clean-home section{padding-top:min(64px,7vw)!important;padding-bottom:min(64px,7vw)!important}
.cs-clean-home .cs-extension{padding-top:44px!important;padding-bottom:44px!important}
@media(max-width:980px){.cs-extension .cs-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.cs-options{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:760px){
  .cs-extension{padding:38px 18px!important}.cs-extension .cs-grid,.cs-options,.cs-clean-details .cs-faq-grid{grid-template-columns:1fr!important}
  .cs-lead,.cs-journey{padding:18px!important}.cs-clean-home section{padding-top:42px!important;padding-bottom:42px!important}
  [class*="card"],[class*="panel"],[class*="module"],[class*="widget"],[class*="kpi"]{box-shadow:0 5px 16px rgba(15,23,42,.05)!important}
}
</style>`;

const homeRuntime = `<script id="${HOME_SCRIPT_ID}" data-cs-clean-home-runtime="1">
(function(){
  function run(){
    if(!document.documentElement)return;
    document.documentElement.classList.add('cs-clean-home');

    var faqGrid=document.querySelector('#faq .cs-faq-grid');
    if(faqGrid && !faqGrid.closest('details.cs-clean-details')){
      var details=document.createElement('details');
      details.className='cs-clean-details';
      var summary=document.createElement('summary');
      summary.textContent='Ver dúvidas frequentes';
      faqGrid.parentNode.insertBefore(details,faqGrid);
      details.appendChild(summary);
      details.appendChild(faqGrid);
    }

    var optionalHeadings=['funcionalidades','resumo do projeto'];
    document.querySelectorAll('h2,h3').forEach(function(heading){
      var text=(heading.textContent||'').trim().toLowerCase();
      if(!optionalHeadings.some(function(label){return text===label || text.indexOf(label+' ')===0;}))return;
      var section=heading.closest('section');
      if(section && !section.matches('#cs-commercial-extension') && !section.closest('#cs-commercial-extension')){
        section.classList.add('cs-clean-home-optional');
        section.setAttribute('aria-hidden','true');
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
  setTimeout(run,60);
})();
</script>`;

function stripInjected(markup){
  return markup
    .replace(new RegExp(`<style id=["']${STYLE_ID}["'][\\s\\S]*?<\\/style>`, 'gi'), '')
    .replace(new RegExp(`<script id=["']${HOME_SCRIPT_ID}["'][\\s\\S]*?<\\/script>`, 'gi'), '');
}

function addStyle(markup){
  let out=stripInjected(markup);
  if(/<\/head>/i.test(out)) return out.replace(/<\/head>/i, `${cleanStyle}\n</head>`);
  return `${cleanStyle}\n${out}`;
}

function addHomeRuntime(markup){
  let out=stripInjected(markup);
  out=addStyle(out);
  if(/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${homeRuntime}\n</body>`);
  return `${out}\n${homeRuntime}`;
}

function encodeTemplate(value){
  return JSON.stringify(value).replace(/<\/script/gi,'<\\/script');
}

function transformBundled(html,isHome){
  const match=html.match(TEMPLATE_RE);
  if(!match)return isHome?addHomeRuntime(html):addStyle(html);
  let template;
  try{template=JSON.parse(match[1]);}
  catch(error){throw new Error(`Template bundle inválido: ${error.message}`);}
  const transformed=isHome?addHomeRuntime(template):addStyle(template);
  let outer=addStyle(html);
  const rematch=outer.match(TEMPLATE_RE);
  if(!rematch)throw new Error('Template bundle desapareceu durante a aplicação do tema clean');
  outer=outer.replace(TEMPLATE_RE,`<script type="__bundler/template">${encodeTemplate(transformed)}</script>`);
  return outer;
}

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(full));
    else if(entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files=await walk(deployRoot);
let changed=0;
for(const file of files){
  const relative=path.relative(deployRoot,file).replaceAll(path.sep,'/');
  const isHome=relative==='index.html';
  const before=await fs.readFile(file,'utf8');
  const after=transformBundled(before,isHome);
  if(after!==before){await fs.writeFile(file,after);changed++;}
  if(!after.includes('data-cs-clean-ui="1"')) throw new Error(`Tema clean ausente em ${relative}`);
  if(isHome && !after.includes('data-cs-clean-home-runtime="1"')) throw new Error('Runtime clean da Home ausente');
}

console.log(`Tema clean Code Solution aplicado em ${files.length} páginas (${changed} atualizadas).`);
