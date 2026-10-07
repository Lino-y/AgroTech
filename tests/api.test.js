// Testes de integração da API: sobem o server.js de verdade numa porta livre, com um
// banco descartável (DATA_FILE), sem tocar no src/data/db.json do repositório.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { calculateCartSummary } from '../src/services/commerce.js';

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
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-api-'));
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
  const email = `teste${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Teste', email, password: 'senha123', ...extra });
  return { ...res, email, token: res.body?.token };
}

const loginAdmin = async () =>
  (await api('POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' })).body.token;

test('cadastro não aceita perfil ADMIN vindo do corpo da requisição', async () => {
  const admin = await newUser({ role: 'ADMIN' });
  assert.equal(admin.status, 400);

  const vendedor = await newUser({ role: 'VENDEDOR' });
  assert.equal(vendedor.status, 201);
  assert.equal(vendedor.body.user.role, 'VENDEDOR');

  const padrao = await newUser();
  assert.equal(padrao.body.user.role, 'PRODUTOR');
});

test('rota de admin barra usuário comum', async () => {
  const { token } = await newUser();
  assert.equal((await api('GET', '/api/admin/users', null, token)).status, 403);
});

test('token assinado com o antigo segredo fixo do código é recusado', async () => {
  const forged = jwt.sign({ sub: 'usr-admin', email: 'admin@agrotech.com.br', role: 'ADMIN' }, 'agrotech-dev-secret');
  assert.equal((await api('GET', '/api/admin/users', null, forged)).status, 401);
});

test('o arquivo do banco e o código do servidor não são servidos', async () => {
  const db = await fetch(`${base}/src/data/db.json`);
  assert.equal(db.status, 404);
  const source = await (await fetch(`${base}/server.js`)).text();
  assert.doesNotMatch(source, /jsonwebtoken/);

  // o front continua sendo servido
  assert.match(await (await fetch(`${base}/`)).text(), /AgroTech/);
  assert.equal((await fetch(`${base}/src/modules/catalog.js`)).status, 200);
  assert.equal((await fetch(`${base}/src/styles/tokens.css`)).status, 200);
  assert.equal((await fetch(`${base}/assets/logo.svg`)).status, 200);
});

test('texto do produto é escapado antes de ser gravado (XSS armazenado)', async () => {
  const { token } = await newUser({ role: 'VENDEDOR' });
  const res = await api('POST', '/api/products', {
    name: '<img src=x onerror=alert(1)>', price: 10, category: 'Grãos', description: 'desc "com aspas"'
  }, token);
  assert.equal(res.status, 201);
  assert.equal(res.body.name, '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(res.body.description, 'desc &quot;com aspas&quot;');
});

test('imagem do produto só aceita link http(s) ou arquivo de imagem', async () => {
  const { token } = await newUser({ role: 'VENDEDOR' });
  const product = { name: 'Milho', price: 10, category: 'Grãos', description: 'lote' };
  assert.equal((await api('POST', '/api/products', { ...product, imageUrl: 'javascript:alert(1)' }, token)).status, 400);
  assert.equal((await api('POST', '/api/products', { ...product, imageUrl: 'x" onerror="alert(1)' }, token)).status, 400);
  const ok = await api('POST', '/api/products', { ...product, imageUrl: 'https://exemplo.com/a b.png' }, token);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.image, 'https://exemplo.com/a%20b.png');
});

test('preço e estoque inválidos são recusados', async () => {
  const { token } = await newUser({ role: 'VENDEDOR' });
  const product = { name: 'Milho', category: 'Grãos', description: 'lote' };
  assert.equal((await api('POST', '/api/products', { ...product, price: -5 }, token)).status, 400);
  assert.equal((await api('POST', '/api/products', { ...product, price: 'abc' }, token)).status, 400);
  assert.equal((await api('POST', '/api/products', { ...product, price: 10, stock: -1 }, token)).status, 400);
});

test('cada usuário vê só os próprios pedidos; o admin vê todos', async () => {
  const a = await newUser();
  const b = await newUser();
  const order = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 1 }] }, a.token);
  assert.equal(order.status, 201);

  const deA = (await api('GET', '/api/orders', null, a.token)).body.map((o) => o.id);
  const deB = (await api('GET', '/api/orders', null, b.token)).body.map((o) => o.id);
  const doAdmin = (await api('GET', '/api/orders', null, await loginAdmin())).body.map((o) => o.id);
  assert.ok(deA.includes(order.body.id));
  assert.ok(!deB.includes(order.body.id));
  assert.ok(doAdmin.includes(order.body.id));
});

test('o total do pedido é calculado no servidor, com o preço do catálogo', async () => {
  const { token } = await newUser();
  const catalog = (await api('GET', '/api/products')).body;
  const product = catalog.find((p) => p.id === '1');

  const res = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 2, price: 0.01 }], total: 1, coupon: 'AGRO10' }, token);
  assert.equal(res.status, 201);
  assert.equal(res.body.total, calculateCartSummary([{ price: product.price, quantity: 2 }], 'AGRO10').total);
  assert.equal(res.body.items[0].price, product.price);

  assert.equal((await api('POST', '/api/orders', { items: [{ id: 'nao-existe', quantity: 1 }] }, token)).status, 400);
  assert.equal((await api('POST', '/api/orders', { items: [{ id: '1', quantity: 0 }] }, token)).status, 400);
  assert.equal((await api('POST', '/api/orders', { items: [] }, token)).status, 400);
});
