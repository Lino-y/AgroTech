// writeDb no Windows: o rename por cima do db.json falha com EPERM enquanto outro leitor o tem aberto.
// renameWithRetry tenta de novo nesses códigos e desiste nos outros (apps/api/rename-retry.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { renameWithRetry } from '../apps/api/rename-retry.js';

const noWait = async () => {};
const failing = (code, times) => {
  let calls = 0;
  const rename = async () => {
    calls += 1;
    if (calls <= times) throw Object.assign(new Error(code), { code });
  };
  return { rename, calls: () => calls };
};

test('EPERM e EBUSY passageiros: tenta de novo e grava', async () => {
  for (const code of ['EPERM', 'EBUSY', 'EACCES']) {
    const fake = failing(code, 3);
    await renameWithRetry(fake.rename, 'a.tmp', 'db.json', noWait);
    assert.equal(fake.calls(), 4);
  }
});

test('erro que não é de arquivo ocupado sobe na primeira vez', async () => {
  const fake = failing('ENOSPC', 1);
  await assert.rejects(renameWithRetry(fake.rename, 'a.tmp', 'db.json', noWait), { code: 'ENOSPC' });
  assert.equal(fake.calls(), 1);
});

test('arquivo ocupado o tempo todo: desiste depois de 10 tentativas', async () => {
  const fake = failing('EPERM', 99);
  await assert.rejects(renameWithRetry(fake.rename, 'a.tmp', 'db.json', noWait), { code: 'EPERM' });
  assert.equal(fake.calls(), 10);
});
