import fs from 'node:fs/promises';

const path='deploy/painel/marketing/index.html';
let html=await fs.readFile(path,'utf8');

const scripts=[
  ['data-cs-marketing-acquisition="1"','<script src="/painel/marketing/acquisition.js" data-cs-marketing-acquisition="1"></script>'],
  ['data-cs-campaign-efficiency="1"','<script src="/painel/marketing/campaign-efficiency.js" data-cs-campaign-efficiency="1"></script>'],
];

for(const [marker,tag] of scripts){
  if(html.includes(marker)) continue;
  html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;
}

await fs.writeFile(path,html);
