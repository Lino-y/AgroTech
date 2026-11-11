// Teste do remapeamento de linhas de remap-refs.js: o deslocamento sai dos hunks do `git diff -U0`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHunks, mapLine } = require('./remap-refs.js');

// Insere 2 linhas depois da 3, troca a 10 por outra, apaga as 20 e 21 e reescreve 30-31 em 3 linhas.
const DIFF = [
  '@@ -3,0 +4,2 @@',
  '@@ -10 +12 @@',
  '@@ -20,2 +22,0 @@',
  '@@ -30,2 +30,3 @@',
].join('\n');

test('parseHunks lê início e tamanho, com o tamanho 1 implícito', () => {
  assert.deepEqual(parseHunks(DIFF)[1], { a: 10, b: 1, c: 12, d: 1 });
  assert.deepEqual(parseHunks(DIFF)[0], { a: 3, b: 0, c: 4, d: 2 });
});

test('mapLine desloca linhas depois de inserção e apagamento', () => {
  const hunks = parseHunks(DIFF);
  assert.equal(mapLine(hunks, 3), 3); // antes da inserção
  assert.equal(mapLine(hunks, 4), 6); // depois da inserção de 2 linhas
  assert.equal(mapLine(hunks, 9), 11);
  assert.equal(mapLine(hunks, 22), 22); // +2 da inserção, -2 do apagamento
  assert.equal(mapLine(hunks, 40), 41); // +2 -2 +1
});

test('mapLine acompanha a troca de uma linha por outra e recusa o que sumiu ou mudou de tamanho', () => {
  const hunks = parseHunks(DIFF);
  assert.equal(mapLine(hunks, 10), 12); // troca 1 por 1
  assert.equal(mapLine(hunks, 20), null); // apagada
  assert.equal(mapLine(hunks, 31), null); // bloco de 2 virou 3
});
