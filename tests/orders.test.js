// Pedidos: ids que não se repetem (issue #27). As rotas sobem o server.js de verdade numa porta
// livre, com banco descartável (DATA_FILE), no mesmo molde de tests/api.test.js, sem tocar no
// src/data/db.json do repositório.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { newOrderId, newProductId, newTrackingCode } from '../src/services/ids.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ORDER_ID = /^AGT-[0-9A-F]{12}$/;
const TRACKING_CODE = /^BR-AGRO-[0-9A-F]{12}-X$/;

// --- Ids (src/services/ids.js) ---

test('id de anúncio, id de pedido e código de rastreio não se repetem', () => {
  // Os geradores antigos repetiam: Date.now() no mesmo milissegundo, e 90 mil (pedido) ou
  // 900 mil (rastreio) valores do Math.random, com colisão provável já nas primeiras centenas.
  for (const generate of [newProductId, newOrderId, newTrackingCode]) {
    const ids = Array.from({ length: 10000 }, generate);
    assert.equal(new Set(ids).size, ids.length, `${generate.name} repetiu`);
  }
});

// --- Rotas da API (server.js) ---

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
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-orders-'));
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['server.js'], {
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
  const email = `pedidos${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Teste', email, password: 'senha123', ...extra });
  return { email, token: res.body?.token };
}

const login = async (email, password) => (await api('POST', '/api/auth/login', { email, password })).body.token;

test('anúncio e pedido novos saem com o id novo, e os gravados antes continuam valendo', async () => {
  const seller = await newUser({ role: 'VENDEDOR' });
  const buyer = await newUser();
  const product = await api('POST', '/api/products', { name: 'Milho', price: 150, category: 'Grãos', description: 'lote' }, seller.token);
  assert.equal(product.status, 201);
  assert.match(product.body.id, UUID);

  // O anúncio novo e o '1' do seed (id antigo) no mesmo pedido.
  const order = await api('POST', '/api/orders', { items: [{ id: product.body.id, quantity: 1 }, { id: '1', quantity: 1 }] }, buyer.token);
  assert.equal(order.status, 201);
  assert.match(order.body.id, ORDER_ID);
  assert.match(order.body.trackingCode, TRACKING_CODE);

  // O pedido do seed, gravado com o id e o rastreio antigos, segue na lista do dono, sem migração.
  const demoOrders = (await api('GET', '/api/orders', null, await login('demo@agrotech.com.br', 'demo123'))).body;
  assert.equal(demoOrders.find((item) => item.id === 'AGT-84920')?.trackingCode, 'BR-AGRO-982134-X');
});
