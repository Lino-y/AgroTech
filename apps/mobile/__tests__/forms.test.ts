// Validação do cadastro no app (o servidor valida de novo) e perfis que o servidor aceita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail, SIGNUP_ROLES, validateRegister } from '../src/lib/forms.ts';

test('e-mail precisa de usuário, arroba e domínio', () => {
  assert.equal(isValidEmail('ana@fazenda.com.br'), true);
  assert.equal(isValidEmail('  ana@fazenda.com  '), true);
  assert.equal(isValidEmail('ana@fazenda'), false);
  assert.equal(isValidEmail('ana fazenda@x.com'), false);
  assert.equal(isValidEmail(''), false);
});

test('cadastro exige nome, e-mail válido e senha, nessa ordem', () => {
  assert.equal(validateRegister({ name: '', email: 'a@b.co', password: 'senha-123' }), 'Informe seu nome.');
  assert.equal(validateRegister({ name: '  ', email: 'a@b.co', password: 'senha-123' }), 'Informe seu nome.');
  assert.equal(validateRegister({ name: 'Ana', email: 'ana', password: 'senha-123' }), 'Informe um e-mail válido.');
  assert.equal(validateRegister({ name: 'Ana', email: 'a@b.co', password: '' }), 'Informe uma senha.');
  assert.equal(validateRegister({ name: 'Ana', email: 'a@b.co', password: 'senha-123' }), null);
});

test('perfis do cadastro são só os que o servidor aceita (ADMIN nunca)', () => {
  assert.deepEqual(
    SIGNUP_ROLES.map((role) => role.value),
    ['PRODUTOR', 'VENDEDOR', 'AMBOS']
  );
});
