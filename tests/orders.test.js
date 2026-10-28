// Pedidos: ids que não se repetem (issue #27) e "Meus Pedidos" carregado do servidor, com a
// data real (issue #25). As rotas sobem o server.js de verdade numa porta livre, com banco
// descartável (DATA_FILE), no mesmo molde de tests/api.test.js, sem tocar no
// src/data/db.json do repositório.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { newOrderId, newProductId, newTrackingCode } from '../src/services/ids.js';
import { formatOrderDate } from '../src/services/orders.js';
import { syncOrders } from '../src/modules/orders-sync.js';

// A data da tela depende do fuso: estes testes rodam no de Brasília em qualquer máquina.
process.env.TZ = 'America/Sao_Paulo';

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

// --- Data na tela (src/services/orders.js) ---

test('data do pedido na tela: createdAt em dd/mm/aaaa; pedido antigo sem data real não vira "Hoje"', () => {
  assert.equal(formatOrderDate({ id: 'AGT-1', createdAt: new Date(2026, 9, 5, 12).toISOString() }), '05/10/2026');
  // Vale o dia de quem vê: 2h de 28/out em UTC ainda é 27/out em Brasília.
  assert.equal(formatOrderDate({ id: 'AGT-2', createdAt: '2026-10-28T02:00:00.000Z' }), '27/10/2026');
  // Pedido do seed: só tem a data legível.
  assert.equal(formatOrderDate({ id: 'AGT-84920', date: '15/Set/2026' }), '15/09/2026');
  // Pedido antigo gravado com "Hoje", sem data nenhuma ou com data que não se lê.
  for (const order of [{ id: 'AGT-3', date: 'Hoje' }, { id: 'AGT-4' }, { id: 'AGT-5', createdAt: 'ontem' }]) {
    assert.equal(formatOrderDate(order), 'não registrada', JSON.stringify(order));
  }
});

// --- Carga da tela (src/modules/orders-sync.js) ---

test('carga de Meus Pedidos: "carregando" sem a lista anterior, depois os pedidos do servidor', async () => {
  const state = { orders: { list: [{ id: 'pedido-anterior' }], loading: false, error: null } };
  const renders = [];
  let respond;
  const done = syncOrders(state, {
    load: () => new Promise((resolve) => { respond = resolve; }),
    render: () => renders.push(structuredClone(state.orders))
  });
  assert.deepEqual(renders, [{ list: [], loading: true, error: null }]);
  respond([{ id: 'AGT-1' }]);
  await done;
  assert.deepEqual(renders.at(-1), { list: [{ id: 'AGT-1' }], loading: false, error: null });
});

test('conta sem pedido termina a carga com a lista vazia e sem erro', async () => {
  const state = { orders: { list: [{ id: 'pedido-anterior' }], loading: false, error: null } };
  await syncOrders(state, { load: async () => [], render() {} });
  assert.deepEqual(state.orders, { list: [], loading: false, error: null });
});

test('falha na carga de Meus Pedidos vira aviso na tela, sem pedido', async () => {
  const state = { orders: { list: [], loading: false, error: null } };
  await syncOrders(state, { load: () => Promise.reject(new Error('Sem conexão com o servidor.')), render() {} });
  assert.deepEqual(state.orders, { list: [], loading: false, error: 'Sem conexão com o servidor.' });
  // Sem mensagem, a tela ficaria sem aviso e sem o "Tentar novamente".
  await syncOrders(state, { load: () => Promise.reject(new Error('')), render() {} });
  assert.equal(state.orders.error, 'Não foi possível carregar os pedidos.');
});

test('resposta atrasada de uma carga anterior não sobrescreve os pedidos atuais (troca de conta)', async () => {
  const state = { orders: { list: [], loading: false, error: null } };
  let respondOld;
  const old = syncOrders(state, { load: () => new Promise((resolve) => { respondOld = resolve; }), render() {} });
  await syncOrders(state, { load: async () => [{ id: 'da-conta-nova' }], render() {} });
  respondOld([{ id: 'da-conta-anterior' }]);
  await old;
  assert.deepEqual(state.orders, { list: [{ id: 'da-conta-nova' }], loading: false, error: null });
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

test('pedido novo grava a data real e não grava mais "Hoje"; o dono o recebe no GET', async () => {
  const buyer = await newUser();
  const order = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 1 }] }, buyer.token);
  assert.equal(order.status, 201);
  assert.ok(!Number.isNaN(Date.parse(order.body.createdAt)), 'pedido novo grava createdAt');
  assert.equal(order.body.date, undefined);
  assert.deepEqual((await api('GET', '/api/orders', null, buyer.token)).body.map((item) => item.id), [order.body.id]);
});
