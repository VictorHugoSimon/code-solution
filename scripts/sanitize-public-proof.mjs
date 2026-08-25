import fs from 'node:fs/promises';

const files=['deploy/index.html'];
const replacements=[
  ['Em produção, com métricas que você consegue auditar','Engenharia preparada para produção e medição'],
  ['+120','Entrega'],
  ['Projetos em produção','Sistemas e plataformas'],
  ['99,9%','SLA'],
  ['Uptime médio observado','Disponibilidade monitorada'],
  ['95+','Web'],
  ['Lighthouse Performance','Performance acompanhada'],
  ['Projetos que entregam resultado.','Exemplos de soluções para problemas reais.'],
  ['Filtre por área e explore alguns dos sistemas que desenvolvemos.','Filtre por área e explore exemplos de soluções que a Code Solution pode estruturar conforme o processo e o contexto de cada empresa.'],
  ['>Cases<','>Exemplos de soluções<'],
];
for(const file of files){
  let html=await fs.readFile(file,'utf8');
  let changed=0;
  for(const [from,to] of replacements){
    if(html.includes(from)){html=html.split(from).join(to);changed++;}
  }
  await fs.writeFile(file,html,'utf8');
  console.log(`${file}: ${changed} public proof replacement(s) applied.`);
}
