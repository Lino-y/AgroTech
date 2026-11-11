// Idempotência de POST /api/orders (issue #62, pré-requisito do app): o cabeçalho Idempotency-Key
// faz um reenvio (rede caiu no meio, toque duplo) devolver o pedido já criado, em vez de outro.
// Sem o cabeçalho, o comportamento é o de sempre. Mesmo molde de tests/orders.test.js.
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
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-idem-'));
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
  throw new Error('apps/api/server.js não subiu em 10s');
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

async function api(method, url, body, token, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let seq = 0;
async function newBuyer() {
  const email = `idem${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Comprador', email, password: 'senha123' });
  return res.body.token;
}

const KEY = 'chave-pedido-0001';
const ITEMS = { items: [{ id: '1', quantity: 2 }] };
const withKey = (key) => ({ 'Idempotency-Key': key });

test('mesma chave e mesmo corpo: o reenvio devolve o pedido criado, sem criar outro', async () => {
  const token = await newBuyer();
  const first = await api('POST', '/api/orders', ITEMS, token, withKey(KEY));
  assert.equal(first.status, 201);
  const again = await api('POST', '/api/orders', ITEMS, token, withKey(KEY));
  assert.equal(again.status, 200);
  assert.equal(again.body.id, first.body.id);
  assert.equal(again.body.trackingCode, first.body.trackingCode);
  const mine = (await api('GET', '/api/orders', null, token)).body;
  assert.deepEqual(mine.map((order) => order.id), [first.body.id]);
});

test('mesma chave com outros itens é erro de cliente (409), e nada novo é gravado', async () => {
  const token = await newBuyer();
  const first = await api('POST', '/api/orders', ITEMS, token, withKey(KEY));
  assert.equal(first.status, 201);
  const other = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 5 }] }, token, withKey(KEY));
  assert.equal(other.status, 409);
  assert.match(other.body.message, /Idempotency-Key/);
  assert.equal((await api('GET', '/api/orders', null, token)).body.length, 1);
});

test('a chave vale por usuário: outro comprador com a mesma chave cria o seu pedido', async () => {
  const ana = await newBuyer();
  const bruno = await newBuyer();
  const a = await api('POST', '/api/orders', ITEMS, ana, withKey(KEY));
  const b = await api('POST', '/api/orders', ITEMS, bruno, withKey(KEY));
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.notEqual(a.body.id, b.body.id);
});

test('reenvios simultâneos com a mesma chave criam um pedido só', async () => {
  const token = await newBuyer();
  const key = 'chave-simultanea-01';
  const results = await Promise.all([1, 2, 3].map(() => api('POST', '/api/orders', ITEMS, token, withKey(key))));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 201]);
  assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
  assert.equal((await api('GET', '/api/orders', null, token)).body.length, 1);
});

test('chave malformada é recusada com 400, antes de qualquer gravação', async () => {
  const token = await newBuyer();
  for (const bad of ['curta', 'tem espaco aqui', 'x'.repeat(65), 'acento-ç-chave-1']) {
    const res = await api('POST', '/api/orders', ITEMS, token, withKey(bad));
    assert.equal(res.status, 400, `chave ${JSON.stringify(bad)} deveria dar 400`);
  }
  assert.equal((await api('GET', '/api/orders', null, token)).body.length, 0);
});

test('sem o cabeçalho, cada POST continua criando um pedido (compatível com a web)', async () => {
  const token = await newBuyer();
  const one = await api('POST', '/api/orders', ITEMS, token);
  const two = await api('POST', '/api/orders', ITEMS, token);
  assert.equal(one.status, 201);
  assert.equal(two.status, 201);
  assert.notEqual(one.body.id, two.body.id);
});
