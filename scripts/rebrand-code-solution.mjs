import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.join(process.cwd(), 'deploy');
const textExtensions = new Set(['.html', '.htm', '.js', '.json', '.xml', '.txt']);
let replacements = 0;
let filesChanged = 0;

function replacementFor(match) {
  return match === match.toLowerCase() ? 'assistente' : 'Code Solution';
}

function applyBranding(before) {
  let after = before;
  const rules = [
    [/\bcodi\b/gi, match => replacementFor(match)],
    [/codi_/gi, 'assistant_'],
    [/%20Codi%20/g, '%20Code%20Solution%20'],
    [/%20codi%20/gi, '%20Code%20Solution%20'],
    [/%22Codi%22/gi, '%22Code%20Solution%22'],
  ];
  for (const [pattern, replacement] of rules) {
    const matches = after.match(pattern) || [];
    if (matches.length) {
      after = after.replace(pattern, replacement);
      replacements += matches.length;
    }
  }
  return after;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const before = await fs.readFile(full, 'utf8');
    const after = applyBranding(before);
    if (after === before) continue;
    await fs.writeFile(full, after);
    filesChanged += 1;
  }
}

await walk(root);

const leftovers = [];
async function verify(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await verify(full);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const text = await fs.readFile(full, 'utf8');
    if (/\bcodi\b/i.test(text) || /codi_/i.test(text) || /%20codi%20/i.test(text)) {
      leftovers.push(path.relative(process.cwd(), full));
    }
  }
}
await verify(root);

if (leftovers.length) {
  throw new Error(`Branding legado ainda encontrado em: ${leftovers.join(', ')}`);
}

console.log(`Branding Code Solution aplicado: ${replacements} substituições em ${filesChanged} arquivo(s).`);
