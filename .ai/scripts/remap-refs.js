#!/usr/bin/env node
// Remapeia referências `arquivo:linha` dos .md depois de um passo que move ou edita arquivos (ADR-0002).
// Uso (na raiz, com as mudanças na árvore de trabalho): node .ai/scripts/remap-refs.js [--apply]
// Sem --apply só simula. Os deslocamentos saem do `git diff -M -U0 HEAD`. Cada referência remapeada é
// conferida: a linha de destino precisa ter o mesmo texto da linha de origem em HEAD; se não, vai para
// "REVISAR". Menções sem linha a um arquivo renomeado são listadas, não reescritas (podem ser história).
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const REF_RE = /`([^`\s:]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?`/g;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 27, stdio: ['ignore', 'pipe', 'ignore'] });
const lines = (text) => text.replace(/\r\n/g, '\n').split('\n');

function parseHunks(diff) {
  return [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map((m) => ({
    a: Number(m[1]),
    b: m[2] === undefined ? 1 : Number(m[2]),
    c: Number(m[3]),
    d: m[4] === undefined ? 1 : Number(m[4]),
  }));
}

// Linha antiga -> linha nova. null: a linha foi apagada ou o bloco dela mudou de tamanho.
function mapLine(hunks, n) {
  let delta = 0;
  for (const { a, b, c, d } of hunks) {
    if (b === 0) {
      if (n <= a) break; // inserção depois da linha a: o que vem antes não muda
      delta += d;
    } else if (n < a) {
      break;
    } else if (n <= a + b - 1) {
      return b === d ? c + (n - a) : null;
    } else {
      delta += d - b;
    }
  }
  return n + delta;
}

function renamedFiles() {
  const map = new Map();
  for (const row of git('diff', '-M', '--name-status', 'HEAD').split('\n')) {
    const [status, from, to] = row.split('\t');
    if (status && status.startsWith('R')) map.set(from, to);
  }
  return map;
}

function existsInHead(file) {
  try {
    git('cat-file', '-e', `HEAD:${file}`);
    return true;
  } catch {
    return false;
  }
}

// Referência `p:n` -> { target, line } (line null se não dá para mapear) ou null se p não é arquivo do repositório.
function resolve(p, n, renames, cache) {
  if (!cache.has(p)) cache.set(p, existsInHead(p) ? parseHunks(git('diff', '-M', '-U0', 'HEAD', '--', p, ...(renames.has(p) ? [renames.get(p)] : []))) : null);
  const hunks = cache.get(p);
  return hunks && { target: renames.get(p) ?? p, line: mapLine(hunks, n) };
}

function sameText(p, from, target, to) {
  const before = lines(git('show', `HEAD:${p}`))[from - 1];
  const after = lines(fs.readFileSync(target, 'utf8'))[to - 1];
  return (before ?? '').trim() === (after ?? '').trim();
}

function remapFile(file, renames, cache, report) {
  const source = fs.readFileSync(file, 'utf8');
  const next = source.replace(REF_RE, (whole, p, a, b) => {
    const first = resolve(p, Number(a), renames, cache);
    const last = b === undefined ? first : resolve(p, Number(b), renames, cache);
    if (!first) return whole;
    if (first.line === null || last.line === null) return report.review.push(`${file}: ${whole} (linha apagada ou bloco redimensionado)`), whole;
    const text = `\`${first.target}:${first.line}${b === undefined ? '' : `-${last.line}`}\``;
    if (text === whole) return whole;
    const ok = sameText(p, Number(a), first.target, first.line) && (b === undefined || sameText(p, Number(b), last.target, last.line));
    report.done += 1;
    if (!ok) report.review.push(`${file}: ${whole} -> ${text} (o texto da linha mudou)`);
    return text;
  });
  return next === source ? null : next;
}

function plainMentions(file, renames) {
  const found = [];
  lines(fs.readFileSync(file, 'utf8')).forEach((text, index) => {
    for (const old of renames.keys()) {
      const escaped = old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^\\w/.-])${escaped}(?!:\\d)`).test(text)) found.push(`${file}:${index + 1}: ${old}`);
    }
  });
  return found;
}

function main() {
  const apply = process.argv.includes('--apply');
  const renames = renamedFiles();
  const cache = new Map();
  const report = { done: 0, review: [], mentions: [], writes: new Map() };
  for (const file of git('ls-files', '-co', '--exclude-standard', '--', '*.md').split('\n').filter(Boolean)) {
    const next = remapFile(file, renames, cache, report);
    if (next !== null) report.writes.set(file, next);
    report.mentions.push(...plainMentions(file, renames));
  }
  console.log(`referências remapeadas: ${report.done} | para revisar: ${report.review.length} | .md alterados: ${report.writes.size}`);
  report.review.forEach((item) => console.log(`  REVISAR ${item}`));
  console.log(`menções sem linha a arquivo renomeado (confira à mão): ${report.mentions.length}`);
  report.mentions.forEach((item) => console.log(`  ${item}`));
  if (!apply) return console.log('simulação (use --apply para gravar).');
  for (const [file, content] of report.writes) fs.writeFileSync(file, content);
  console.log('aplicado.');
}

module.exports = { parseHunks, mapLine };
if (require.main === module) main();
