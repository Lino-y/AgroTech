// RNF01: substitui hex literais por tokens CSS em src/modules/catalog.js.
// Os valores dos tokens são idênticos aos hex anteriores — sem mudança visual.
// Uso: node scripts/apply-tokens.js
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'src/modules/catalog.js';
const MAP = {
  '#FFFFFF': 'var(--white)',
  '#ffffff': 'var(--white)',
  '#1B5E20': 'var(--forest-900)',
  '#2E7D32': 'var(--forest-800)',
  '#388E3C': 'var(--forest-700)',
  '#66BB6A': 'var(--forest-500)',
  '#81C784': 'var(--leaf-300)',
  '#A5D6A7': 'var(--leaf-200)',
  '#C8E6C9': 'var(--leaf-100)',
  '#E8F5E9': 'var(--leaf-50)',
  '#EEF9F0': 'var(--leaf-tint)',
  '#F4FBF7': 'var(--paper-50)',
  '#6C8574': 'var(--muted)',
  '#5D6F62': 'var(--muted-strong)',
  '#163D27': 'var(--ink-strong)',
  '#163d27': 'var(--ink-strong)',
  '#1D2A1C': 'var(--ink-soft)',
  '#C62828': 'var(--error)',
  '#E57373': 'var(--error-light)',
  '#FFEBEE': 'var(--error-bg)',
  '#FFCDD2': 'var(--error-border)',
  '#F57F17': 'var(--warn)',
  '#7A5A00': 'var(--warn-strong)',
  '#FFF8E1': 'var(--warn-bg)',
  '#FFE082': 'var(--warn-border)',
  '#FBBF24': 'var(--warn-accent)',
  '#D9A441': 'var(--wheat)',
};

let src = readFileSync(FILE, 'utf8');
let total = 0;
for (const [hex, token] of Object.entries(MAP)) {
  const parts = src.split(hex);
  total += parts.length - 1;
  src = parts.join(token);
}
writeFileSync(FILE, src);
console.log(`${total} substituições aplicadas em ${FILE}`);

// self-check: nenhum hex mapeado sobrou
const rest = src.match(/#(?:FFFFFF|1B5E20|2E7D32|388E3C|66BB6A|81C784|A5D6A7|C8E6C9|E8F5E9|EEF9F0|F4FBF7|6C8574|5D6F62|163[Dd]27|1D2A1C|C62828|E57373|FFEBEE|FFCDD2|F57F17|7A5A00|FFF8E1|FFE082|FBBF24|D9A441)/g);
if (rest) {
  console.error(`ERRO: sobraram ${rest.length} ocorrências não substituídas:`, rest);
  process.exit(1);
}
console.log('self-check OK: nenhum hex mapeado restante');
