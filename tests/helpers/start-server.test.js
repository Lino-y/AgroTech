// Teste do helper que sobe o servidor nos testes (tests/helpers/start-server.js). O servidor pede a porta
// ao sistema (PORT=0) e o helper lê a porta real do log: não há porta escolhida de antemão para colidir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './start-server.js';

test('sobe o servidor e só dá por pronto quando o próprio processo avisa que escuta', async () => {
  const started = await startServer({ env: { JWT_SECRET: 'segredo-do-helper' } });
  try {
    const health = await fetch(`${started.base}/api/health`);
    assert.equal(health.status, 200);
  } finally {
    started.kill();
  }
});

test('variável com valor undefined sai do ambiente do servidor, mesmo se o processo a tiver', async () => {
  process.env.APP_MIN_VERSION = '9.9.9';
  try {
    const started = await startServer({ env: { APP_MIN_VERSION: undefined, APP_LATEST_VERSION: undefined, APP_APK_FILE: undefined, JWT_SECRET: 'segredo-do-helper' } });
    try {
      const body = await (await fetch(`${started.base}/api/app-config`)).json();
      assert.deepEqual(body, { minVersion: '0.0.0', latestVersion: null, downloadUrl: null });
    } finally {
      started.kill();
    }
  } finally {
    delete process.env.APP_MIN_VERSION;
  }
});

test('guarda a saída do servidor (o log que o teste pode conferir)', async () => {
  const started = await startServer({ env: { JWT_SECRET: 'segredo-do-helper' } });
  try {
    assert.match(started.output(), /AgroTech backend running/);
  } finally {
    started.kill();
  }
});

test('dois servidores sobem ao mesmo tempo, em portas diferentes, sem colidir', async () => {
  const [a, b] = await Promise.all([
    startServer({ env: { JWT_SECRET: 'segredo-do-helper' } }),
    startServer({ env: { JWT_SECRET: 'segredo-do-helper' } })
  ]);
  try {
    assert.notEqual(a.base, b.base);
    assert.equal((await fetch(`${a.base}/api/health`)).status, 200);
    assert.equal((await fetch(`${b.base}/api/health`)).status, 200);
  } finally {
    a.kill();
    b.kill();
  }
});
