import fs from 'node:fs/promises';

const failures=[];
const page=await fs.readFile('deploy/painel/prospeccao/index.html','utf8');
const asset=await fs.readFile('deploy/painel/prospeccao/operations.js','utf8');
const api=await fs.readFile('robo/prospecting-activity.js','utf8');

const requireText=(source,needle,label)=>{if(!source.includes(needle))failures.push(`${label}: missing ${needle}`);};

requireText(page,'data-cs-prospecting-operations="1"','prospecting page');
requireText(page,'/painel/prospeccao/operations.js','prospecting page');
requireText(asset,"const API='/api/crm/prospecting/activity'",'prospecting widget');
requireText(asset,"connections:15",'prospecting daily target');
requireText(asset,"firstMessages:5",'prospecting daily target');
requireText(asset,"meetingsBooked:2",'prospecting weekly target');
for(const icp of ['Agronegócio','Logística e transporte','Varejo e distribuição','Processos corporativos']) requireText(asset,icp,'ICP playbook');
requireText(api,"'/crm/prospecting/activity'",'prospecting API');
requireText(api,'prospecting_daily_activity','prospecting API storage');
requireText(api,'America/Sao_Paulo','prospecting business date');

if(failures.length){
  console.error('Prospecting operations contract failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Prospecting operations contract OK: daily execution, D1 API, targets and ICP playbooks verified.');
