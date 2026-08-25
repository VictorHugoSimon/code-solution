import fs from 'node:fs/promises';

const path='deploy/painel/atendimento/index.html';
let html=await fs.readFile(path,'utf8');
const marker='data-cs-attendance-playbook="1"';
const tag=`<script src="/painel/atendimento/playbook.js" ${marker}></script>`;
if(!html.includes(marker)){
  html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;
  await fs.writeFile(path,html);
}
