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
      'name="consent"',
      'href="/privacidade/"',
      'code-solution-atendente.victorhugoteixeirasimon6.workers.dev/lead',
      "window.gtag('event','generate_lead'",
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
  const commercialMarkers = (template.match(/COMMERCIAL-EXTENSION:START/g) || []).length;
  const schemaMarkers = (template.match(/SEO-SCHEMA:START/g) || []).length;
  if (commercialMarkers !== 1) failures.push(`${spec.file}: expected 1 commercial marker in bundle, found ${commercialMarkers}`);
  if (schemaMarkers !== 1) failures.push(`${spec.file}: expected 1 schema marker in bundle, found ${schemaMarkers}`);
}

if (failures.length) {
  console.error('Bundled surface validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Bundled surfaces OK: post-unpack commercial UI, AEO and Home lead capture verified.');

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
