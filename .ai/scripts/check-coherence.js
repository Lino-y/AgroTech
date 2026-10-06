#!/usr/bin/env node
// Varre .ai/, docs/ e .claude/ atrás de referências de arquivo quebradas
// (ex: ORCHESTRATOR.md apontando para uma skill que foi renomeada/apagada).
// Sem dependências, sem CI — roda com `node .ai/scripts/check-coherence.js`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['.ai', 'docs', '.claude', '.github'].filter((d) => fs.existsSync(path.join(ROOT, d)));
const PATH_TOKEN_RE = /\.(?:ai|claude|github)\/[A-Za-z0-9_\-./]+\.(?:md|json|js|ya?ml)|docs\/[A-Za-z0-9_\-./]+\.(?:md|json)/g;

function listMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

let brokenCount = 0;
const files = SCAN_DIRS.flatMap((d) => listMarkdownFiles(path.join(ROOT, d)));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const tokens = new Set(content.match(PATH_TOKEN_RE) || []);
  for (const token of tokens) {
    const clean = token.replace(/[.,;:)]+$/, '');
    const target = path.join(ROOT, clean);
    if (!fs.existsSync(target)) {
      brokenCount += 1;
      console.log(`${path.relative(ROOT, file)}: referência quebrada -> ${clean}`);
    }
  }
}

if (brokenCount === 0) {
  console.log(`OK: ${files.length} arquivos .md verificados, nenhuma referência quebrada.`);
  process.exit(0);
}

console.log(`\n${brokenCount} referência(s) quebrada(s) encontrada(s).`);
process.exit(1);
