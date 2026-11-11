// Issue #26: rota /api que não existe responde 404 em JSON, e não o index.html com 200. Fora de /api,
// a SPA continua servindo o index.html. Sobe o server.js com banco descartável (DATA_FILE).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

let server;
let base;
let dataDir;

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-routes-'));
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['apps/api/server.js'], {
    env: { ...process.env, PORT: String(port), DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server.js não subiu em 10s');
});

after(() => {
  server?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

test('rota /api inexistente responde 404 em JSON, em GET e em POST', async () => {
  const get = await fetch(`${base}/api/nao-existe`);
  assert.equal(get.status, 404);
  assert.equal(get.headers.get('content-type')?.includes('application/json'), true);
  assert.equal((await get.json()).message, 'Rota não encontrada.');

  const post = await fetch(`${base}/api/nao-existe`, { method: 'POST' });
  assert.equal(post.status, 404);
});

test('fora de /api a SPA continua servindo o index.html', async () => {
  const res = await fetch(`${base}/alguma-tela`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<html/i);
});
