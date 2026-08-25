import fs from 'node:fs/promises';
import path from 'node:path';

const deploy = path.join(process.cwd(), 'deploy');
const casesRoot = path.join(deploy, 'cases');
const marker = 'data-cs-case-tracking';
const scriptTag = `<script ${marker} src="/assets/case-tracking.js" defer></script>`;
const client = String.raw`(() => {
  'use strict';
  const API='https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev/event';
  const KEY='cs_anon_session_v1';
  function clean(v,n=180){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,n)}
  function sessionId(){try{let id=localStorage.getItem(KEY);if(!id||!/^[A-Za-z0-9._:-]{8,80}$/.test(id)){id=crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem(KEY,id)}return id}catch{return'ephemeral-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}
  function attr(){const q=new URLSearchParams(location.search);let host='';try{host=document.referrer?new URL(document.referrer).host.toLowerCase():''}catch{}return{source:clean(q.get('utm_source'),100)||'case_direct',medium:clean(q.get('utm_medium'),100)||'site',campaign:clean(q.get('utm_campaign'),160)||null,referrerHost:host||null}}
  function slug(){const p=location.pathname.split('/').filter(Boolean);return clean(p[1]||'cases',120)}
  function send(eventName,metadata={}){const a=attr();fetch(API,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({eventName,sessionId:sessionId(),pagePath:location.pathname,source:a.source,medium:a.medium,campaign:a.campaign,referrerHost:a.referrerHost,metadata})}).catch(()=>{})}
  document.addEventListener('DOMContentLoaded',()=>{const name=slug();send('case_view',{case:name});document.addEventListener('click',e=>{const a=e.target.closest('[data-case-cta],a[href*="utm_source=case"]');if(!a)return;send('case_cta_click',{case:clean(a.getAttribute('data-case-cta')||name,120),label:clean(a.textContent,160),target:clean(a.pathname||a.href,220)})},{passive:true})});
})();`;

await fs.mkdir(path.join(deploy,'assets'),{recursive:true});
await fs.writeFile(path.join(deploy,'assets','case-tracking.js'),client,'utf8');

async function walk(dir){
  let entries=[];try{entries=await fs.readdir(dir,{withFileTypes:true})}catch{return}
  for(const entry of entries){const full=path.join(dir,entry.name);if(entry.isDirectory()){await walk(full);continue}if(!/\.html?$/i.test(entry.name))continue;let html=await fs.readFile(full,'utf8');if(html.includes(marker))continue;html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,`${scriptTag}</body>`):html+scriptTag;await fs.writeFile(full,html,'utf8')}
}
await walk(casesRoot);

const caseUrls=['https://www.codesolution.com.br/cases/','https://www.codesolution.com.br/cases/sos-truck/','https://www.codesolution.com.br/cases/tonini/','https://www.codesolution.com.br/cases/code-solution/'];
const sitemapPath=path.join(deploy,'sitemap.xml');
let sitemap=await fs.readFile(sitemapPath,'utf8');
for(const url of caseUrls){if(sitemap.includes(`<loc>${url}</loc>`))continue;const node=`\n  <url><loc>${url}</loc><changefreq>monthly</changefreq><priority>${url.endsWith('/cases/')?'0.8':'0.7'}</priority></url>`;sitemap=sitemap.replace(/\s*<\/urlset>/,`${node}\n</urlset>`)}
await fs.writeFile(sitemapPath,sitemap,'utf8');
console.log('Case surfaces ready: attribution + sitemap.');
