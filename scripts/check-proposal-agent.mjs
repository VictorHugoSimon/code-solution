import fs from 'node:fs/promises';

const [agent, autonomy, migration, panel] = await Promise.all([
  fs.readFile('robo/proposal-agent.js','utf8'),
  fs.readFile('robo/autonomous-os.js','utf8'),
  fs.readFile('crm/migrations/0008_proposal_agent.sql','utf8'),
  fs.readFile('deploy/painel/crm/propostas/index.html','utf8'),
]);

const failures=[];
const requireText=(source,needle,label)=>{if(!source.includes(needle)) failures.push(`${label}: missing ${needle}`)};
const forbid=(source,re,label)=>{if(re.test(source)) failures.push(`${label}: forbidden ${re}`)};

for(const needle of ['generateProposalDraft','discoverProposalCandidates','pending_approval','discoveryGaps','assumptions','Não invente','deterministic_fallback']) requireText(agent,needle,'proposal agent');
for(const needle of ["actionType: 'generate_proposal_draft'","actionType: 'proposal_send'","approvalRequired: true","agent: 'proposal'",'syncProposalApproval']) requireText(autonomy,needle,'autonomy');
for(const needle of ['CREATE TABLE IF NOT EXISTS crm_proposals','CREATE TABLE IF NOT EXISTS crm_proposal_events','UNIQUE (lead_id, version)','approval_status']) requireText(migration,needle,'proposal schema');
for(const needle of ['Proposal Agent','/api/crm/autonomy','Aprovar para envio','Gerar nova versão','Lacunas de discovery']) requireText(panel,needle,'proposal panel');

// Proposal generation is internal-only. External execution stays in separate gated adapters.
forbid(agent,/WHATSAPP_TOKEN|WHATSAPP_PHONE_ID|OWNER_WHATSAPP|sendgrid|resend\.com|graph\.facebook\.com/i,'proposal agent external send isolation');
if(!/proposal_send[\s\S]{0,400}approvalRequired:\s*true/.test(autonomy)) failures.push('autonomy: proposal_send is not visibly approval gated');
if(!/generate_proposal_draft[\s\S]{0,500}approvalRequired:\s*false/.test(autonomy)) failures.push('autonomy: proposal draft generation must remain an internal safe task');

if(failures.length){console.error('Proposal Agent contract failed:');for(const x of failures)console.error(`- ${x}`);process.exit(1)}
console.log('Proposal Agent contract OK: versioned draft generation, no external sending, explicit discovery gaps and human approval gate verified.');
