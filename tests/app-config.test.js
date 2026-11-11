// GET /api/app-config: versão mínima do app (APP_MIN_VERSION). Sobe o server.js de verdade,
// com banco descartável (DATA_FILE). Valor inválido derruba o servidor na subida.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAppMinVersion } from '../apps/api/app-version.js';

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

function start(extraEnv) {
  const dir = mkdtempSync(path.join(tmpdir(), 'agrotech-appconfig-'));
  const env = { ...process.env, DATA_FILE: path.join(dir, 'db.json'), JWT_SECRET: '', ...extraEnv };
  if (!('APP_MIN_VERSION' in extraEnv)) delete env.APP_MIN_VERSION; // não herdar do shell
  return { dir, env };
}

async function withServer(extraEnv, fn) {
  const port = await freePort();
  const { dir, env } = start({ ...extraEnv, PORT: String(port) });
  const child = spawn(process.execPath, ['apps/api/server.js'], { env, stdio: 'ignore' });
  try {
    const base = `http://localhost:${port}`;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) return await fn(base);
      } catch {
        // ainda subindo
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('server.js não subiu em 10s');
  } finally {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('sem APP_MIN_VERSION, o padrão é 0.0.0, sem token', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/api/app-config`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { minVersion: '0.0.0' });
  });
});

test('com APP_MIN_VERSION=1.2.0, devolve a versão configurada', async () => {
  await withServer({ APP_MIN_VERSION: '1.2.0' }, async (base) => {
    const res = await fetch(`${base}/api/app-config`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { minVersion: '1.2.0' });
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
