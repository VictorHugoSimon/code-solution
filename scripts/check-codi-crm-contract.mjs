import fs from 'node:fs/promises';

const assistant = await fs.readFile('deploy/assistente/index.html', 'utf8');
const worker = await fs.readFile('robo/atendente-worker.js', 'utf8');

const failures = [];
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) failures.push(`${label}: missing ${needle}`);
};
const rejectText = (source, needle, label) => {
  if (source.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
};

for (const id of ['leadName', 'leadWhatsapp', 'leadNeed', 'leadConsent', 'leadSubmit', 'leadResult']) {
  requireText(assistant, `id="${id}"`, 'assistant form');
}
requireText(assistant, "fetch(API+'/lead'", 'assistant API');
requireText(assistant, 'consentAt:new Date().toISOString()', 'assistant consent');
requireText(assistant, '...utm()', 'assistant attribution');
requireText(assistant, "track('generate_lead'", 'assistant analytics');
requireText(assistant, 'href="/privacidade/"', 'assistant privacy');
requireText(assistant, 'Não envie senhas, documentos, dados bancários', 'assistant safety copy');
rejectText(assistant, 'CRM_ADMIN_KEY', 'assistant secret isolation');
rejectText(assistant, 'localStorage', 'assistant storage');
rejectText(assistant, 'sessionStorage', 'assistant storage');

requireText(worker, "url.pathname === '/lead' && request.method === 'POST'", 'worker route');
requireText(worker, 'return createLead(request, env, cors)', 'worker route');
requireText(worker, "fields.name = 'required'", 'worker validation');
requireText(worker, "fields.whatsapp = 'invalid'", 'worker validation');
requireText(worker, "fields.need = 'required'", 'worker validation');
requireText(worker, "'consentAt'", 'worker sanitize');
for (const field of ['source','campaign','medium','content','term','landingPage','referrer']) {
  requireText(worker, `'${field}'`, 'worker attribution');
}
requireText(worker, 'leadId: id', 'worker response');
requireText(worker, 'nextAction: lead.nextAction', 'worker response');
requireText(worker, "status: 'novo'", 'worker lifecycle');

if (failures.length) {
  console.error('Codi ↔ CRM contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Codi ↔ CRM contract OK: consent, attribution, validation, lead creation and secret isolation verified.');
