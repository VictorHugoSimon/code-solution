import fs from 'node:fs/promises';

const path='deploy/assistente/index.html';
let html=await fs.readFile(path,'utf8');

html=html.replace(
  "let messages=[],started=false,busy=false,leadCreated=false,firstNeed='',leadContext={},turns=0;",
  "let messages=[],started=false,busy=false,leadCreated=false,firstNeed='',leadContext={},turns=0,humanRequested=false;"
);

html=html.replace(
  "if(d.handoffRequested){fallback.classList.add('show');track('assistant_handoff_requested',{business_hours_open:Boolean(d.businessHoursOpen)})}",
  "if(d.handoffRequested){humanRequested=true;fallback.classList.add('show');track('assistant_handoff_requested',{business_hours_open:Boolean(d.businessHoursOpen)})}"
);

html=html.replace(
  "const payload={name,whatsapp,company:company||undefined,segment:segment||undefined,need,consentAt:new Date().toISOString(),...utm()};",
  "const attribution=utm();const payload={name,whatsapp,company:company||undefined,segment:segment||undefined,need,consentAt:new Date().toISOString(),...attribution,medium:humanRequested?'acao_humana':attribution.medium,content:humanRequested?'handoff_requested':attribution.content};"
);

if(!html.includes('humanRequested=false')) throw new Error('human handoff state injection failed');
if(!html.includes("medium:humanRequested?'acao_humana'")) throw new Error('human handoff CRM marker injection failed');

await fs.writeFile(path,html);
