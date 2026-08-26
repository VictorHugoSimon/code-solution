import fs from 'node:fs/promises';

const HOME = 'deploy/index.html';
const JOURNEY_JS = 'deploy/home-journey.js';
const TEMPLATE_RE = /<script type="__bundler\/template">([\s\S]*?)<\/script>/;

function transformMarkup(markup) {
  let next = markup;
  next = next.replace(/Enviar e ver meu próximo passo/g, 'Enviar formulário');
  next = next.replace(/<a\b[^>]*\bdata-wa-link\b[^>]*>[\s\S]*?<\/a>/gi, '');
  next = next.replace(/<p\b[^>]*class="cs-journey-note"[^>]*>[^<]*WhatsApp[^<]*<\/p>/gi, '');
  return next;
}

function encodeTemplate(value) {
  return JSON.stringify(value).replace(/<\/script/gi, '<\\/script');
}

let html = await fs.readFile(HOME, 'utf8');
html = transformMarkup(html);

const match = html.match(TEMPLATE_RE);
if (!match) throw new Error('__bundler/template não encontrado na Home');
let template;
try { template = JSON.parse(match[1]); }
catch (error) { throw new Error(`Template empacotado inválido: ${error.message}`); }
template = transformMarkup(template);
html = html.replace(TEMPLATE_RE, `<script type="__bundler/template">${encodeTemplate(template)}</script>`);
await fs.writeFile(HOME, html);

let js = await fs.readFile(JOURNEY_JS, 'utf8');
js = js.replace(/\n\s*var wa = [\s\S]*?root\.querySelector\('\[data-wa-link\]'\)\.href = [^;]+;\n/, '\n');
js = js.replace(/Não consegui registrar agora\. Tente novamente ou use o WhatsApp como alternativa\./g, 'Não consegui registrar agora. Tente novamente em alguns instantes.');
js = js.replace(/Enviar e ver meu próximo passo/g, 'Enviar formulário');
await fs.writeFile(JOURNEY_JS, js);

const finalHome = await fs.readFile(HOME, 'utf8');
const finalJs = await fs.readFile(JOURNEY_JS, 'utf8');
const finalTemplateMatch = finalHome.match(TEMPLATE_RE);
if (!finalTemplateMatch) throw new Error('Template empacotado ausente após transformação');
const finalTemplate = JSON.parse(finalTemplateMatch[1]);

for (const surface of [finalHome, finalTemplate]) {
  if (!surface.includes('Enviar formulário')) throw new Error('CTA Enviar formulário ausente');
  if (/data-wa-link/i.test(surface)) throw new Error('CTA WhatsApp ainda presente na jornada');
}
if (/data-wa-link/i.test(finalJs)) throw new Error('JavaScript ainda depende do CTA WhatsApp');
if (!finalJs.includes("fetch(API + '/lead'")) throw new Error('Fluxo /lead removido por engano');
if (!finalJs.includes("window.gtag('event', 'generate_lead'")) throw new Error('Evento generate_lead removido por engano');

console.log('Home convertida para formulário como CTA principal; lead continua entrando no CRM via /lead.');
