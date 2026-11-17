// Renomeia tokens que colidem com src/styles/ui.css (valores diferentes lá).
// Uso: node scripts/rename-tokens.js
import { readFileSync, writeFileSync } from 'node:fs';

const RENAMES = {
  '--forest-900': '--green-900',
  '--forest-800': '--green-800',
  '--forest-700': '--green-700',
  '--forest-500': '--green-500',
  '--leaf-300': '--green-300',
  '--leaf-200': '--green-200',
  '--leaf-100': '--green-100',
  '--leaf-50': '--green-50',
  '--leaf-tint': '--green-tint',
};

for (const FILE of ['src/modules/catalog.js', 'src/styles/tokens.css']) {
  let src = readFileSync(FILE, 'utf8');
  let total = 0;
  for (const [from, to] of Object.entries(RENAMES)) {
    const re = new RegExp(from.replace('-', '\\-') + '(?![\\w-])', 'g');
    src = src.replace(re, () => { total++; return to; });
  }
  writeFileSync(FILE, src);
  console.log(`${FILE}: ${total} renomeações`);
  if (src.includes('\uFFFD')) { console.error(`${FILE}: corrompido!`); process.exit(1); }
}

// self-check: tokens.css não declara mais nomes colidentes, e catalog.js só usa os novos
const css = readFileSync('src/styles/tokens.css', 'utf8');
const js = readFileSync('src/modules/catalog.js', 'utf8');
for (const stale of Object.keys(RENAMES)) {
  if (css.includes(stale) || js.includes(`var(${stale})`)) {
    console.error(`self-check FALHOU: ${stale} ainda presente`); process.exit(1);
  }
}
console.log('self-check OK');
