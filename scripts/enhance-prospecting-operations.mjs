import fs from 'node:fs/promises';

const path='deploy/painel/prospeccao/index.html';
let html=await fs.readFile(path,'utf8');
const marker='data-cs-prospecting-operations="1"';
const tag='<script src="/painel/prospeccao/operations.js" data-cs-prospecting-operations="1"></script>';

if(!html.includes(marker)){
  html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;
}

await fs.writeFile(path,html);
