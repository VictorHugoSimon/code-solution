import fs from 'node:fs/promises';

const path='deploy/painel/marketing/index.html';
let html=await fs.readFile(path,'utf8');
const marker='data-cs-marketing-acquisition="1"';
const tag='<script src="/painel/marketing/acquisition.js" data-cs-marketing-acquisition="1"></script>';
if(!html.includes(marker)) html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}${tag}`;
await fs.writeFile(path,html);
