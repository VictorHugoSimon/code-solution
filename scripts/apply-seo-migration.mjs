import fs from 'node:fs/promises';

const path='deploy/_worker.js';
let source=await fs.readFile(path,'utf8');

const START='// SEO-LEGACY-MIGRATION:START';
const END='// SEO-LEGACY-MIGRATION:END';
source=source.replace(new RegExp(`\\n?${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}\\n?`,'g'),'\n');

// Remove every previously generated legacy route, including older builds that
// did not persist the SEO-LEGACY-ROUTE:END marker. This keeps pages:prepare
// idempotent and prevents duplicate `legacyTarget` declarations.
source=source.replace(
  /\n\s*const legacyTarget = legacyRedirectFor\(url\.pathname\);\s*\n\s*if \(legacyTarget\) return Response\.redirect\(new URL\(legacyTarget, url\.origin\)\.toString\(\), 301\);(?:\s*\n\s*\/\/ SEO-LEGACY-ROUTE:END)?/g,
  '\n',
);

const constants=`${START}
const LEGACY_REDIRECTS = new Map([
  ['/portfolio-category/website/','/servicos/'],
  ['/portfolio/apple-3d-design/','/servicos/'],
  ['/portfolio/illustration-visual-design/','/servicos/'],
  ['/a-guide-for-businesses-in-the-digital-age/','/blog/'],
  ['/the-art-of-crafting-compelling-brand-stories/','/blog/'],
  ['/how-analytics-can-drive-business-success/','/blog/'],
]);
function legacyRedirectFor(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  if (LEGACY_REDIRECTS.has(normalized)) return LEGACY_REDIRECTS.get(normalized);
  if (/^\\/portfolio(?:-category)?\\//i.test(normalized)) return '/servicos/';
  if (/^\\/(?:author|category|tag)\\//i.test(normalized)) return '/blog/';
  return '';
}
${END}`;

const exportAnchor='export default {';
if(!source.includes(exportAnchor)) throw new Error('Pages Worker export anchor not found');
source=source.replace(exportAnchor,`${constants}\n\n${exportAnchor}`);

const canonical=`    if (url.hostname === 'codesolution.com.br') {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }`;
if(!source.includes(canonical)) throw new Error('canonical redirect block not found');
const route=`${canonical}

    const legacyTarget = legacyRedirectFor(url.pathname);
    if (legacyTarget) return Response.redirect(new URL(legacyTarget, url.origin).toString(), 301);
    // SEO-LEGACY-ROUTE:END`;
source=source.replace(canonical,route);

const routeCount=(source.match(/const legacyTarget = legacyRedirectFor\(url\.pathname\);/g)||[]).length;
if(routeCount!==1) throw new Error(`Expected exactly one legacy SEO route after migration, found ${routeCount}`);

await fs.writeFile(path,source,'utf8');
console.log('Permanent legacy SEO redirects applied idempotently to Pages Worker.');

function escapeRe(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
