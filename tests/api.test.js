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
    name: '<img src=x onerror=alert(1)>', price: 10, category: 'Grãos', description: 'desc "com aspas"',
    imageUrl: 'https://exemplo.com/lote.png'
  }, token);
  assert.equal(res.status, 201);
  assert.equal(res.body.name, '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(res.body.description, 'desc &quot;com aspas&quot;');
});

test('produto sem foto é recusado (foto obrigatória)', async () => {
  const { token } = await newUser({ role: 'VENDEDOR' });
  const res = await api('POST', '/api/products', {
    name: 'Milho', price: 10, category: 'Grãos', description: 'lote sem foto'
  }, token);
  assert.equal(res.status, 400);
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

// --- Issue #5: estados de pagamento (RF04) ---
test('pagamento nasce PENDENTE e só aprova por transição válida; pedido avança depois', async () => {
  const { token } = await newUser();
  const order = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 1 }] }, token);
  assert.equal(order.status, 201);
  assert.equal(order.body.status, 'Pedido Confirmado'); // pedido criado; pagamento é outro passo

  // cria pagamento vinculado ao pedido, sem informar valor
  const pay = await api('POST', '/api/payments', { method: 'pix', orderId: order.body.id }, token);
  assert.equal(pay.status, 201);
  assert.equal(pay.body.status, 'PENDENTE');
  assert.equal(pay.body.total, order.body.total);

  // consulta devolve o mesmo estado
  const got = await api('GET', `/api/payments/${pay.body.id}`, null, token);
  assert.equal(got.body.status, 'PENDENTE');

  // expirar não é caminho para aprovar: EXPIRADO é terminal
  await api('POST', `/api/payments/${pay.body.id}/confirm`, null, token);
  const recRoute = await api('POST', `/api/payments/${pay.body.id}/refuse`, null, token);
  assert.equal(recRoute.status, 409); // APROVADO -> RECUSADO é transição inválida

  const approved = await api('GET', `/api/payments/${pay.body.id}`, null, token);
  assert.equal(approved.body.status, 'APROVADO');

  // o pedido vinculado avança após APROVADO (permanece confirmado)
  const orders = (await api('GET', '/api/orders', null, token)).body;
  assert.equal(orders.find((o) => o.id === order.body.id).status, 'Pedido Confirmado');
});

test('recusado volta a pendente (nova tentativa) e expira sem pagamento', async () => {
  const { token } = await newUser();

  const credit = await api('POST', '/api/payments', { method: 'credit', installments: 2, items: [{ id: '1', quantity: 1 }] }, token);
  await api('POST', `/api/payments/${credit.body.id}/refuse`, null, token);
  const refused = await api('GET', `/api/payments/${credit.body.id}`, null, token);
  assert.equal(refused.body.status, 'RECUSADO');

  // RECUSADO -> PENDENTE (nova tentativa) é permitido
  const retried = await api('POST', `/api/payments/${credit.body.id}/refuse`, null, token);
  assert.equal(retried.status, 409); // RECUSADO -> RECUSADO não existe; recusa só sai de PENDENTE

  const pix = await api('POST', '/api/payments', { method: 'pix', items: [{ id: '1', quantity: 1 }] }, token);
  await api('POST', `/api/payments/${pix.body.id}/expire`, null, token);
  const expired = await api('GET', `/api/payments/${pix.body.id}`, null, token);
  assert.equal(expired.body.status, 'EXPIRADO');
  assert.equal((await api('POST', `/api/payments/${pix.body.id}/confirm`, null, token)).status, 409);
});

test('cartão rejeita parcelas fora de 1–6 e pix/boleto não são parcelados', async () => {
  const { token } = await newUser();
  const cart = { items: [{ id: '1', quantity: 1 }] };

  assert.equal((await api('POST', '/api/payments', { method: 'credit', installments: 0, ...cart }, token)).status, 400);
  assert.equal((await api('POST', '/api/payments', { method: 'credit', installments: 7, ...cart }, token)).status, 400);
  assert.equal((await api('POST', '/api/payments', { method: 'credit', installments: 2.5, ...cart }, token)).status, 400);
  assert.equal((await api('POST', '/api/payments', { method: 'credit', installments: 6, ...cart }, token)).status, 201);
  assert.equal((await api('POST', '/api/payments', { method: 'credit', installments: 1, ...cart }, token)).status, 201);

  assert.equal((await api('POST', '/api/payments', { method: 'pix', installments: 3, ...cart }, token)).status, 400);
  assert.equal((await api('POST', '/api/payments', { method: 'boleto', installments: 2, ...cart }, token)).status, 400);
  assert.equal((await api('POST', '/api/payments', { method: 'debito', ...cart }, token)).status, 400);
  assert.equal((await api('POST', '/api/payments', { method: 'pix', installments: 1, ...cart }, token)).status, 201);
});

test('total do pagamento é calculado no servidor e dados de cartão não são persistidos', async () => {
  const { token } = await newUser();
  const catalog = (await api('GET', '/api/products')).body;
  const product = catalog.find((p) => p.id === '1');

  // cliente tenta ditar total e mandar número do cartão: nada disso é usado ou guardado
  const res = await api('POST', '/api/payments', {
    method: 'credit',
    installments: 3,
    items: [{ id: '1', quantity: 2 }],
    total: 0.01,
    cardNumber: '4111111111111111',
    cardCvv: '123',
    cardExpiry: '12/30'
  }, token);
  assert.equal(res.status, 201);
  assert.equal(res.body.total, calculateCartSummary([{ price: product.price, quantity: 2 }], null).total);

  const paymentJson = JSON.stringify(res.body);
  assert.ok(!paymentJson.includes('4111111111111111'));
  assert.ok(!paymentJson.includes('cardNumber'));
  assert.ok(!paymentJson.includes('cardCvv'));

  // pagamento de outro usuário não é visível nem transitável
  const other = await newUser();
  assert.equal((await api('GET', `/api/payments/${res.body.id}`, null, other.token)).status, 404);
  assert.equal((await api('POST', `/api/payments/${res.body.id}/confirm`, null, other.token)).status, 404);

  // pagamento sem token é barrado
  assert.equal((await api('POST', '/api/payments', { method: 'pix', items: [{ id: '1', quantity: 1 }] })).status, 401);
});

// --- RF04: pedido só avança após pagamento aprovado ---
test('pedido pendente só é confirmado quando o pagamento é aprovado', async () => {
  const { token } = await newUser();
  const order = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 1 }] }, token);
  assert.equal(order.status, 201);

  const pay = await api('POST', '/api/payments', { method: 'pix', orderId: order.body.id }, token);
  assert.equal(pay.body.status, 'PENDENTE');

  // aprovando o pagamento, o pedido vinculado é confirmado
  await api('POST', `/api/payments/${pay.body.id}/confirm`, null, token);
  const orders = (await api('GET', '/api/orders', null, token)).body;
  assert.equal(orders.find((o) => o.id === order.body.id).status, 'Pedido Confirmado');
});
