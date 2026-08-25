(() => {
  'use strict';
  const API='https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev/event';
  const KEY='cs_anon_session_v1';
  function clean(v,n=180){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,n)}
  function sessionId(){try{let id=localStorage.getItem(KEY);if(!id||!/^[A-Za-z0-9._:-]{8,80}$/.test(id)){id=crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem(KEY,id)}return id}catch{return'ephemeral-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}
  function attr(){const q=new URLSearchParams(location.search);let host='';try{host=document.referrer?new URL(document.referrer).host.toLowerCase():''}catch{}return{source:clean(q.get('utm_source'),100)||'case_direct',medium:clean(q.get('utm_medium'),100)||'site',campaign:clean(q.get('utm_campaign'),160)||null,referrerHost:host||null}}
  function slug(){const p=location.pathname.split('/').filter(Boolean);return clean(p[1]||'cases',120)}
  function send(eventName,metadata={}){const a=attr();fetch(API,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({eventName,sessionId:sessionId(),pagePath:location.pathname,source:a.source,medium:a.medium,campaign:a.campaign,referrerHost:a.referrerHost,metadata})}).catch(()=>{})}
  document.addEventListener('DOMContentLoaded',()=>{const name=slug();send('case_view',{case:name});document.addEventListener('click',e=>{const a=e.target.closest('[data-case-cta],a[href*="utm_source=case"]');if(!a)return;send('case_cta_click',{case:clean(a.getAttribute('data-case-cta')||name,120),label:clean(a.textContent,160),target:clean(a.pathname||a.href,220)})},{passive:true})});
})();