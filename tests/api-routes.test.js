// Issue #26: rota /api que não existe responde 404 em JSON, e não o index.html com 200. Fora de /api,
// a SPA continua servindo o index.html. Sobe o server.js com banco descartável (DATA_FILE).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from './helpers/start-server.js';

let server;
let base;
let dataDir;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-routes-'));
  const started = await startServer({ env: { DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '' } });
  base = started.base;
  server = started;
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
