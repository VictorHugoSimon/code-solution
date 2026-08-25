import fs from 'node:fs/promises';
import path from 'node:path';

const target = path.join(process.cwd(),'deploy','assets','acquisition-tracking.js');
const marker = 'CS-LEAD-ATTRIBUTION-BRIDGE';
let js = await fs.readFile(target,'utf8');
js = js.replace(/\n?\/\* CS-LEAD-ATTRIBUTION-BRIDGE:START \*\/[\s\S]*?\/\* CS-LEAD-ATTRIBUTION-BRIDGE:END \*\//g,'');

const bridge = String.raw`
/* CS-LEAD-ATTRIBUTION-BRIDGE:START */
(() => {
  'use strict';
  const SESSION_KEY='cs_anon_session_v1';
  const EVENT_API='https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev/event';
  const nativeFetch=window.fetch.bind(window);
  const clean=(v,max=180)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  function sessionId(){
    try{
      let id=localStorage.getItem(SESSION_KEY);
      if(!id||!/^[A-Za-z0-9._:-]{8,80}$/.test(id)){
        id=(crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(36).slice(2));
        localStorage.setItem(SESSION_KEY,id);
      }
      return id;
    }catch{return 'ephemeral-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
  }
  function attribution(){
    const q=new URLSearchParams(location.search);let referrerHost='';
    try{referrerHost=document.referrer?new URL(document.referrer).host.toLowerCase():'';}catch{}
    let source=clean(q.get('utm_source'),100),medium=clean(q.get('utm_medium'),100),campaign=clean(q.get('utm_campaign'),160);
    if(!source&&referrerHost){
      if(/(^|\.)google\./.test(referrerHost)){source='google';medium=medium||'organic';}
      else if(/(^|\.)bing\.com$/.test(referrerHost)){source='bing';medium=medium||'organic';}
      else if(/(^|\.)linkedin\.com$/.test(referrerHost)){source='linkedin';medium=medium||'social';}
      else if(/(^|\.)instagram\.com$/.test(referrerHost)){source='instagram';medium=medium||'social';}
      else if(/(^|\.)facebook\.com$/.test(referrerHost)){source='facebook';medium=medium||'social';}
      else {source=referrerHost;medium=medium||'referral';}
    }
    return {source:source||'direct',medium:medium||'none',campaign:campaign||null,referrerHost:referrerHost||null};
  }
  async function emit(eventName,metadata={}){
    const a=attribution();
    try{await nativeFetch(EVENT_API,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({eventName,sessionId:sessionId(),pagePath:location.pathname,source:a.source,medium:a.medium,campaign:a.campaign,referrerHost:a.referrerHost,metadata})});}catch{}
  }
  window.CodeSolutionAcquisition={sessionId,attribution,track:emit};
  window.fetch=async function(input,init){
    let url='';try{url=typeof input==='string'?input:input instanceof URL?input.href:input?.url||'';}catch{}
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    const isLead=method==='POST' && /code-solution-atendente\.victorhugoteixeirasimon6\.workers\.dev\/lead(?:\?|$)/.test(url);
    if(!isLead) return nativeFetch(input,init);
    let nextInit=init;
    try{
      const body=typeof init?.body==='string'?JSON.parse(init.body):null;
      if(body&&typeof body==='object'&&!Array.isArray(body)){
        const a=attribution();
        body.sessionId=body.sessionId||sessionId();
        body.source=body.source||a.source;
        body.medium=body.medium||a.medium;
        body.campaign=body.campaign||a.campaign;
        body.landingPage=body.landingPage||location.pathname;
        nextInit={...init,body:JSON.stringify(body)};
      }
    }catch{}
    const response=await nativeFetch(input,nextInit);
    if(response.ok) emit('lead_submit_success',{placement:location.pathname}).catch(()=>{});
    return response;
  };
})();
/* CS-LEAD-ATTRIBUTION-BRIDGE:END */
`;

await fs.writeFile(target,js.trimEnd()+'\n'+bridge.trim()+'\n','utf8');
console.log('Acquisition session -> lead bridge applied.');
