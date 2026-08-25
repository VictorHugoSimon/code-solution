import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.join(process.cwd(), 'deploy');
const textExtensions = new Set(['.html', '.htm', '.js', '.json', '.xml', '.txt']);
let replacements = 0;
let filesChanged = 0;

function replacementFor(match) {
  // Human-facing legacy brand becomes Code Solution. Lowercase standalone
  // analytics/source values become the neutral identifier "assistente".
  return match === match.toLowerCase() ? 'assistente' : 'Code Solution';
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
    const matches = before.match(/\bcodi\b/gi) || [];
    if (!matches.length) continue;
    const after = before.replace(/\bcodi\b/gi, replacementFor);
    await fs.writeFile(full, after);
    replacements += matches.length;
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
    if (/\bcodi\b/i.test(text)) leftovers.push(path.relative(process.cwd(), full));
  }
}
await verify(root);

if (leftovers.length) {
  throw new Error(`Branding legado ainda encontrado em: ${leftovers.join(', ')}`);
}

console.log(`Branding Code Solution aplicado: ${replacements} substituições em ${filesChanged} arquivo(s).`);
