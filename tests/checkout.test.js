// Issue #40: o total cobrado sai do catálogo e da regra do carrinho (calculateCartSummary), nunca do
// corpo da requisição. Sobe o server.js de verdade numa porta livre, com banco descartável (DATA_FILE),
// no molde de tests/api.test.js.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { calculateCartSummary } from '../packages/domain/commerce.js';
import { startServer } from './helpers/start-server.js';

let server;
let base;
let dataDir;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-checkout-'));
  const started = await startServer({ env: { DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '' } });
  base = started.base;
  server = started;
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

async function buyerToken() {
  const email = `comprador${Date.now()}${Math.random().toString(36).slice(2, 8)}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Comprador', email, password: 'senha123' });
  return res.body.token;
}

// Preço de catálogo do seed (server.js, produto '1'): é o que o servidor cobra, não o que o cliente manda.
const CATALOG_PRICE = 89.9;

test('pedido com cupom e frete sai com o total de calculateCartSummary e a resposta traz esse total', async () => {
  const token = await buyerToken();
  const order = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 2 }], coupon: 'AGRO10' }, token);
  assert.equal(order.status, 201);
  const expected = calculateCartSummary([{ price: CATALOG_PRICE, quantity: 2 }], 'AGRO10');
  assert.equal(expected.shipping, 35, 'a compra é menor que R$ 800 e não tem frete grátis: o frete entra');
  assert.equal(order.body.total, expected.total);
});

test('o cliente não consegue mandar outro total, frete, rastreio ou preço de item', async () => {
  const token = await buyerToken();
  const order = await api('POST', '/api/orders', {
    items: [{ id: '1', quantity: 2, price: 0.01 }],
    coupon: 'AGRO10',
    total: 1,
    shipping: 0,
    trackingCode: 'BR-AGRO-000000-X'
  }, token);
  assert.equal(order.status, 201);
  assert.equal(order.body.total, calculateCartSummary([{ price: CATALOG_PRICE, quantity: 2 }], 'AGRO10').total);
  assert.notEqual(order.body.trackingCode, 'BR-AGRO-000000-X');
});
