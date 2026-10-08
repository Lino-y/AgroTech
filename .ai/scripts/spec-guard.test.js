// node --test .ai/scripts/spec-guard.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { evidenceViolations, missingSpecUpdate } = require('./spec-guard');

const files = { 'src/services/cart.js': 30, 'server.js': 440 };
const lines = (path) => files[path] || 0;
const check = (text) => evidenceViolations([{ file: 'docs/tasks/1-carrinho/blueprint.md', text }], lines);

test('[x] sem evidência é barrado; com evidência válida passa', () => {
  assert.strictEqual(check('- [x] Cupom AGRO10 aplica 10%').length, 1);
  assert.strictEqual(check('- [x] Cupom AGRO10 aplica 10% — ✅ (`src/services/cart.js:13`)').length, 0);
});

test('✅ em linha de critério exige evidência que exista', () => {
  assert.strictEqual(check('| CA02 | Frete grátis acima de R$ 800 | teste | ✅ | sem prova |').length, 1);
  assert.strictEqual(check('| CA02 | Frete grátis | teste | ✅ | `src/services/cart.js:99` |').length, 1); // linha fora
  assert.strictEqual(check('| CA02 | Frete grátis | teste | ✅ | `src/services/nao-existe.js:1` |').length, 1);
  assert.strictEqual(check('| CA02 | Frete grátis | teste | ✅ | `src/services/cart.js:19-25` |').length, 0);
  assert.strictEqual(check('| CA03 | Login | teste | ✅ | `server.js:298` |').length, 0); // arquivo na raiz
});

test('item não marcado como feito não exige evidência', () => {
  assert.strictEqual(check('- [ ] Checkout via Pix — 🔴 não existe').length, 0);
  assert.strictEqual(check('| CA09 | Boleto | teste | 🔴 | nada |').length, 0);
});

test('código sem spec é barrado, salvo "Spec: n/a — motivo"', () => {
  const code = ['src/services/cart.js'];
  assert.strictEqual(missingSpecUpdate(code, ['']), true);
  assert.strictEqual(missingSpecUpdate(['server.js'], ['']), true);
  assert.strictEqual(missingSpecUpdate([...code, 'docs/tasks/1-carrinho/blueprint.md'], ['']), false);
  assert.strictEqual(missingSpecUpdate([...code, '.ai/specs/02-requisitos-funcionais.md'], ['']), false);
  assert.strictEqual(missingSpecUpdate(code, ['- Spec: n/a — só atualiza dependência']), false);
  assert.strictEqual(missingSpecUpdate(code, ['- Spec: ']), true);
  assert.strictEqual(missingSpecUpdate(['README.md', 'tests/services.test.js'], ['']), false);
});
