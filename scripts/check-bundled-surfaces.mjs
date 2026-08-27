import fs from 'node:fs/promises';

const checks = [
  {
    file: 'deploy/index.html',
    outer: ['SEO-FALLBACK:START', 'SEO-SCHEMA:START'],
    inner: [
      'SEO-SCHEMA:START',
      'COMMERCIAL-EXTENSION:START',
      'id="cs-commercial-extension"',
      'id="cs-home-lead"',
      'id="cs-home-lead-form"',
      'data-cs-home-journey',
      'data-cs-home-layout-refinement="3"',
      'Enviar formulário',
      'data-cs-success',
      'name="consent"',
      'href="/privacidade/"',
      'src="/home-journey.js"',
      'O que as empresas perguntam antes de contratar',
    ],
  },
  {
    file: 'deploy/servicos/index.html',
    outer: ['SEO-FALLBACK:START', 'SEO-SCHEMA:START'],
    inner: [
      'SEO-SCHEMA:START',
      'COMMERCIAL-EXTENSION:START',
      'id="cs-services-aeo"',
      'data-aeo-answer',
      'Software, automação, IA e dados sob medida',
    ],
  },
];

const failures = [];
for (const spec of checks) {
  const html = await fs.readFile(spec.file, 'utf8');
  for (const needle of spec.outer) if (!html.includes(needle)) failures.push(`${spec.file}: outer missing ${needle}`);
  const template = readTemplate(html, spec.file);
  if (template === null) continue;
  for (const needle of spec.inner) if (!template.includes(needle)) failures.push(`${spec.file}: bundled template missing ${needle}`);
  if (spec.file === 'deploy/index.html' && /data-wa-link/i.test(template)) failures.push('deploy/index.html: WhatsApp CTA must not exist in guided Home journey');
  const commercialMarkers = (template.match(/COMMERCIAL-EXTENSION:START/g) || []).length;
  const schemaMarkers = (template.match(/SEO-SCHEMA:START/g) || []).length;
  if (commercialMarkers !== 1) failures.push(`${spec.file}: expected 1 commercial marker in bundle, found ${commercialMarkers}`);
  if (schemaMarkers !== 1) failures.push(`${spec.file}: expected 1 schema marker in bundle, found ${schemaMarkers}`);
}

const journeyRuntime = await fs.readFile('deploy/home-journey.js', 'utf8').catch(() => '');
for (const needle of [
  'code-solution-atendente.victorhugoteixeirasimon6.workers.dev',
  "fetch(API + '/lead'",
  "window.gtag('event', 'generate_lead'",
  "source: q.get('utm_source') || 'site_home_journey'",
  "root.querySelector('[data-protocol]')",
  'Enviar formulário',
]) {
  if (!journeyRuntime.includes(needle)) failures.push(`deploy/home-journey.js: missing ${needle}`);
}
if (/data-wa-link/i.test(journeyRuntime)) failures.push('deploy/home-journey.js: runtime still depends on WhatsApp CTA');

if (failures.length) {
  console.error('Bundled surface validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Bundled surfaces OK: premium Home refinement v3, form-first conversion, CRM capture, AEO and analytics runtime verified.');

function readTemplate(html, file) {
  const match = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
  if (!match) {
    failures.push(`${file}: __bundler/template not found`);
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    failures.push(`${file}: invalid bundled template JSON: ${error.message}`);
    return null;
  }
}
