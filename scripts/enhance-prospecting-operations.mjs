import fs from 'node:fs/promises';

const path='deploy/painel/prospeccao/index.html';
let html=await fs.readFile(path,'utf8');
const operationsMarker='data-cs-prospecting-operations="1"';
const operationsTag='<script src="/painel/prospeccao/operations.js" data-cs-prospecting-operations="1"></script>';
const progressMarker='data-cs-prospecting-progress="1"';
const progressTag='<script src="/painel/prospeccao/progress.js" data-cs-prospecting-progress="1"></script>';

if(!html.includes(operationsMarker)){
  html=html.includes('</body>')?html.replace('</body>',`${operationsTag}</body>`):`${html}${operationsTag}`;
}
if(!html.includes(progressMarker)){
  html=html.includes('</body>')?html.replace('</body>',`${progressTag}</body>`):`${html}${progressTag}`;
}

await fs.writeFile(path,html);
