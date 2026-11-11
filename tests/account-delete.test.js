// Exclusão de conta: DELETE /api/auth/me. Sobe o apps/api/server.js numa porta livre com banco
// descartável (DATA_FILE), no molde de tests/orders.test.js, e lê o arquivo para provar o que sumiu.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

let server;
let base;
let dataDir;
const dbFile = () => path.join(dataDir, 'db.json');
const readRawDb = () => readFileSync(dbFile(), 'utf8');

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-account-delete-'));
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['apps/api/server.js'], {
    env: { ...process.env, PORT: String(port), DATA_FILE: dbFile(), JWT_SECRET: '' },
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
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

async function api(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let seq = 0;
async function newUser(extra = {}) {
  const email = `exclusao${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Teste', email, password: 'senha123', ...extra });
  return { email, token: res.body?.token };
}

const del = (token, body) => api('DELETE', '/api/auth/me', body, token);

test('sem senha no corpo: 400', async () => {
  const user = await newUser();
  assert.equal((await del(user.token, {})).status, 400);
  assert.equal((await del(user.token)).status, 400);
});

test('senha errada: 403 (nunca 401) e a conta continua existindo', async () => {
  const user = await newUser();
  const res = await del(user.token, { password: 'errada' });
  assert.equal(res.status, 403);
  assert.equal(res.body.message, 'Senha incorreta.');
  assert.equal((await api('POST', '/api/auth/login', { email: user.email, password: 'senha123' })).status, 200);
});

test('administrador não exclui a própria conta por esta rota: 403', async () => {
  const admin = await api('POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' });
  const res = await del(admin.body.token, { password: 'admin123' });
  assert.equal(res.status, 403);
  assert.equal(res.body.message, 'Conta administradora não pode ser excluída por aqui.');
  assert.equal((await api('GET', '/api/auth/me', null, admin.body.token)).status, 200);
});

test('exclusão: 204, token antigo e senha antiga deixam de valer', async () => {
  const user = await newUser();
  const res = await del(user.token, { password: 'senha123' });
  assert.equal(res.status, 204);
  assert.equal((await api('GET', '/api/auth/me', null, user.token)).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { email: user.email, password: 'senha123' })).status, 401);
});

test('some anúncio e lançamento do usuário; pedidos ficam anonimizados; o resto não é tocado', async () => {
  const seller = await newUser({ role: 'VENDEDOR' });
  const buyer = await newUser();
  const other = await newUser();
  const product = await api('POST', '/api/products', { name: 'Milho', price: 150, category: 'Grãos', description: 'lote' }, seller.token);
  await api('POST', '/api/finance/entries', { title: 'Adubo', amount: 10, type: 'EXPENSE' }, seller.token);
  await api('POST', '/api/finance/entries', { title: 'Outro', amount: 5, type: 'INCOME' }, other.token);
  const order = await api('POST', '/api/orders', { items: [{ id: product.body.id, quantity: 1 }] }, buyer.token);
  assert.equal(order.status, 201);

  // Compra feita pelo próprio vendedor: some o e-mail dele do pedido (dono).
  const sellerOrder = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 1 }] }, seller.token);

  assert.equal((await del(seller.token, { password: 'senha123' })).status, 204);

  const raw = readRawDb();
  assert.ok(!raw.includes(seller.email), 'e-mail do vendedor ainda aparece no banco');
  const db = JSON.parse(raw);
  assert.ok(!db.products.some((p) => p.id === product.body.id));
  assert.ok(!db.financeEntries.some((e) => e.title === 'Adubo'));
  assert.ok(db.financeEntries.some((e) => e.title === 'Outro'), 'lançamento de outro usuário foi removido');

  const kept = db.orders.find((o) => o.id === order.body.id);
  assert.ok(kept, 'pedido do comprador sumiu');
  assert.equal(kept.ownerEmail, buyer.email);
  assert.equal(kept.items[0].ownerEmail, `conta-excluida-${kept.id}@removido.invalid`);
  assert.equal(kept.items[0].sellerName, 'Vendedor removido');

  const keptOwn = db.orders.find((o) => o.id === sellerOrder.body.id);
  assert.equal(keptOwn.ownerEmail, `conta-excluida-${keptOwn.id}@removido.invalid`);

  // O comprador continua vendo o pedido dele.
  assert.deepEqual((await api('GET', '/api/orders', null, buyer.token)).body.map((o) => o.id), [order.body.id]);
});

test('o e-mail do comprador excluído some do pedido, mas o pedido fica na base', async () => {
  const seller = await newUser({ role: 'VENDEDOR' });
  const buyer = await newUser();
  const product = await api('POST', '/api/products', { name: 'Soja', price: 200, category: 'Grãos', description: 'lote' }, seller.token);
  const order = await api('POST', '/api/orders', { items: [{ id: product.body.id, quantity: 2 }] }, buyer.token);
  assert.equal((await del(buyer.token, { password: 'senha123' })).status, 204);

  const raw = readRawDb();
  assert.ok(!raw.includes(buyer.email), 'e-mail do comprador ainda aparece no banco');
  const kept = JSON.parse(raw).orders.find((o) => o.id === order.body.id);
  assert.equal(kept.ownerEmail, `conta-excluida-${kept.id}@removido.invalid`);
  assert.equal(kept.items[0].ownerEmail, seller.email, 'item do vendedor que não foi excluído foi alterado');
});
