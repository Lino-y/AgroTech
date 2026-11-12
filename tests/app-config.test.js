// GET /api/app-config: versão mínima do app (APP_MIN_VERSION). Sobe o server.js de verdade,
// com banco descartável (DATA_FILE). Valor inválido derruba o servidor na subida.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAppMinVersion } from '../apps/api/app-version.js';
import { startServer as startServerProcess } from './helpers/start-server.js';



async function withServer(extraEnv, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'agrotech-appconfig-'));
  const started = await startServerProcess({
    env: { DATA_FILE: path.join(dir, 'db.json'), JWT_SECRET: '', APP_MIN_VERSION: undefined, APP_LATEST_VERSION: undefined, APP_APK_FILE: undefined, ...extraEnv }
  });
  try {
    return await fn(started.base);
  } finally {
    started.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('sem APP_MIN_VERSION, o padrão é 0.0.0, sem token', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/api/app-config`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { minVersion: '0.0.0', latestVersion: null, downloadUrl: null });
  });
});

test('com APP_MIN_VERSION=1.2.0, devolve a versão configurada', async () => {
  await withServer({ APP_MIN_VERSION: '1.2.0' }, async (base) => {
    const res = await fetch(`${base}/api/app-config`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { minVersion: '1.2.0', latestVersion: null, downloadUrl: null });
  });
});

// Valor inválido derruba a subida (readAppMinVersion vira process.exit(1) no server.js). Testado aqui
// direto, sem subir processo: um processo que sai cedo tira o servidor do relatório de cobertura.
test('versão mínima: sem variável é 0.0.0; MAJOR.MINOR.PATCH passa; o resto é erro de configuração', () => {
  assert.deepEqual(readAppMinVersion(undefined), { version: '0.0.0' });
  assert.deepEqual(readAppMinVersion('1.2.0'), { version: '1.2.0' });
  for (const bad of ['abc', '1.2', '1.2.0-beta', '', ' 1.2.0', 'v1.2.0']) {
    const result = readAppMinVersion(bad);
    assert.ok('error' in result, `${JSON.stringify(bad)} deveria ser erro`);
    assert.match(result.error, /APP_MIN_VERSION/);
  }
});
