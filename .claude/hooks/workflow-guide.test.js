// node --test .claude/hooks/workflow-guide.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { guide } = require('./workflow-guide');

test('pedido de implementação na main recebe o fluxo e os avisos de estado', () => {
  const text = guide({ prompt: 'Fazer a correção do login numa branch nova', branch: 'main', behind: 3 });
  assert.match(text, /Fluxo obrigatório/);
  assert.match(text, /Você está na main/);
  assert.match(text, /3 commit\(s\) atrás/);
  assert.match(text, /não cita spec/);
});

test('pedido que cita a spec, numa branch em dia, recebe só o fluxo', () => {
  const text = guide({ prompt: 'implementar o CA03 da spec 005', branch: 'feat/x', behind: 0 });
  assert.match(text, /Fluxo obrigatório/);
  assert.match(text, /em-andamento/); // regra 10: sinalizar a issue e pegar só as livres
  assert.doesNotMatch(text, /Estado agora/);
});

test('pergunta que não pede mudança não recebe nada', () => {
  assert.strictEqual(guide({ prompt: 'o que essa função retorna?', branch: 'main', behind: 0 }), '');
  assert.strictEqual(guide({ prompt: 'qual o address do servidor?', branch: 'main', behind: 0 }), '');
});
