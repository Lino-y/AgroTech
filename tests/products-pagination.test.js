// Paginação opcional de GET /api/products: sem limit a lista inteira (a SPA depende disso),
// com limit a fatia da página. Sobe o server.js de verdade numa porta livre, com banco
// descartável (DATA_FILE), no molde de tests/orders.test.js.
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
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-paginacao-'));
  const started = await startServer({ env: { DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '' } });
  base = started.base;
  server = started;
  const email = `paginacao-${Date.now()}@agrotech.dev`;
  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Vendedor', email, password: 'senha123', role: 'VENDEDOR' })
  });
  const { token } = await reg.json();
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${base}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Paginado ${i}`, price: 10 + i, category: 'Grãos', description: 'lote' })
    });
    assert.equal(res.status, 201);
  }
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

async function list(query = '') {
  const res = await fetch(`${base}/api/products${query}`);
  return { status: res.status, total: res.headers.get('x-total-count'), body: await res.json() };
}

test('sem parâmetros: lista inteira e X-Total-Count com o total', async () => {
  const all = await list();
  assert.equal(all.status, 200);
  assert.ok(all.body.length >= 5);
  assert.equal(all.total, String(all.body.length));
});

test('limit com page: fatias na ordem do catálogo, sem repetir item, somando o total', async () => {
  const all = await list();
  const seen = [];
  for (let page = 1; page <= Math.ceil(all.body.length / 2); page++) {
    const slice = await list(`?limit=2&page=${page}`);
    assert.equal(slice.status, 200);
    assert.equal(slice.total, String(all.body.length));
    assert.ok(slice.body.length <= 2);
    seen.push(...slice.body.map((p) => p.id));
  }
  assert.deepEqual(seen, all.body.map((p) => p.id));
  assert.equal(new Set(seen).size, all.body.length);
});

test('limit sem page vale page=1', async () => {
  const all = await list();
  const first = await list('?limit=2');
  assert.deepEqual(first.body.map((p) => p.id), all.body.slice(0, 2).map((p) => p.id));
});

test('página além do fim: [] com 200 e o total no cabeçalho', async () => {
  const all = await list();
  const beyond = await list('?limit=2&page=9999');
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body, []);
  assert.equal(beyond.total, String(all.body.length));
});

test('page sem limit: 400 dizendo que falta limit', async () => {
  const res = await list('?page=2');
  assert.equal(res.status, 400);
  assert.match(res.body.message, /limit/);
});

test('valores inválidos: 400 com o nome do parâmetro errado', async () => {
  for (const [query, param] of [
    ['?limit=0', 'limit'], ['?limit=101', 'limit'], ['?limit=abc', 'limit'], ['?limit=1.5', 'limit'],
    ['?limit=2&page=0', 'page'], ['?limit=2&page=abc', 'page'], ['?limit=2&page=-1', 'page']
  ]) {
    const res = await list(query);
    assert.equal(res.status, 400, query);
    assert.match(res.body.message, new RegExp(param), query);
  }
});
