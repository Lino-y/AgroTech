// Issue #20: handler inline (onclick="...", oninput="..." etc.) roda no escopo global da página e só
// enxerga o que está em window ou é global do navegador. Função interna de módulo, como o showToast
// de src/modules/catalog.js, dá ReferenceError no clique e o botão não faz nada. Este teste lê os
// templates de src/ e barra a classe inteira desse erro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import globals from 'globals';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const sources = readdirSync(SRC, { recursive: true })
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file: path.join('src', file), text: readFileSync(path.join(SRC, file), 'utf8') }));

// ponytail: só handler entre aspas duplas, como todos os templates hoje. Nome montado na hora
// (`${handler}(...)`) e método de objeto (`event.stopPropagation()`) passam sem checagem.
const HANDLER_RE = /(?<=\s)(on[a-z]+)\s*=\s*"([^"]*)"/g;
const CALL_RE = /(?<![\w$.])(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/g;
const KEYWORDS = ['if', 'for', 'while', 'switch'];

test('handler inline dos templates de src/ só chama função exposta em window ou global do navegador', () => {
  const exposed = sources.flatMap(({ text }) => [...text.matchAll(/window\.([\w$]+)\s*=(?!=)/g)].map(([, name]) => name));
  const known = new Set([...exposed, ...Object.keys(globals.browser), ...Object.keys(globals.builtin), ...KEYWORDS]);
  const problems = [];
  let handlers = 0;
  for (const { file, text } of sources) {
    for (const { 1: event, 2: code, index } of text.matchAll(HANDLER_RE)) {
      handlers++;
      const body = code
        .replace(/\$\{[^}]*\}/g, '') // ${...} roda ao montar o HTML, não no evento
        .replace(/'(?:[^'\\]|\\.)*'/g, "''"); // texto entre aspas não é chamada
      for (const [, name] of body.matchAll(CALL_RE)) {
        if (!known.has(name)) problems.push(`${file}:${text.slice(0, index).split('\n').length} ${event} chama ${name}(), que não está em window`);
      }
    }
  }
  assert.ok(handlers > 0, 'nenhum handler inline encontrado: a busca dos templates quebrou');
  assert.deepEqual(problems, []);
});
