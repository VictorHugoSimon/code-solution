import fs from 'node:fs/promises';

const path='deploy/painel/crm/index.html';
let html=await fs.readFile(path,'utf8');
const scripts=[
  {marker:'data-cs-crm-executive="1"',tag:'<script src="/painel/crm/executive.js" data-cs-crm-executive="1"></script>'},
  {marker:'data-cs-crm-operations="1"',tag:'<script src="/painel/crm/operations.js" data-cs-crm-operations="1"></script>'},
];
for(const item of scripts){
  if(!html.includes(item.marker)) html=html.includes('</body>')?html.replace('</body>',`${item.tag}</body>`):`${html}${item.tag}`;
}
await fs.writeFile(path,html);
