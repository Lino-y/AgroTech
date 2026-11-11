// Revisão geral (segurança e casos-limite) do server.js. Sobe o servidor de verdade com banco
// descartável (DATA_FILE) e cobre o que só aparece com requisição real: texto do usuário que vira
// HTML, limites de entrada, erro de entrada e de banco, perfil editado, ids e fila de gravação.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const servers = [];

// capture: guarda stdout/stderr do servidor para conferir o que ele escreve no log.
async function startServer({ capture = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'agrotech-hard-'));
  const dataFile = path.join(dir, 'db.json');
  const port = await freePort();
  const child = spawn(process.execPath, ['apps/api/server.js'], {
    env: { ...process.env, PORT: String(port), DATA_FILE: dataFile, JWT_SECRET: '' },
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'ignore'
  });
  let output = '';
  if (capture) {
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
  }
  const base = `http://localhost:${port}`;
  const server = { base, dir, dataFile, child, output: () => output };
  servers.push(server);
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return server;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server.js não subiu em 10s');
}

async function call(server, method, url, body, token) {
  const res = await fetch(server.base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let seq = 0;
async function newUser(server, extra = {}) {
  const email = `hard${++seq}-${Date.now()}@agrotech.dev`;
  const res = await call(server, 'POST', '/api/auth/register', { name: 'Teste', email, password: 'senha123', ...extra });
  assert.equal(res.status, 201, 'cadastro do usuário de teste');
  return { token: res.body.token, user: res.body.user, email };
}

const productBody = (extra = {}) => ({
  name: 'Lote de teste', price: 100, unit: 'kg', category: 'Grãos', location: 'MS - BR', description: 'descrição', imageUrl: '', ...extra
});

let shared;
before(async () => {
  shared = await startServer();
});
after(() => {
  for (const { child, dir } of servers) {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('avaliação e campos da loja gravam o texto sem HTML', async () => {
  const { token } = await newUser(shared, { role: 'VENDEDOR' });
  const product = (await call(shared, 'POST', '/api/products', productBody(), token)).body;

  const store = await call(shared, 'PUT', '/api/auth/store', {
    name: '<img src=x onerror=alert(2)>', propertyOrCompany: '<script>1</script>', storeBio: '<i>bio</i>', storePhone: '"><b>', storeLocation: '<u>x</u>', storeHours: "<s>'</s>"
  }, token);
  assert.equal(store.status, 200);
  for (const field of ['name', 'propertyOrCompany', 'storeBio', 'storePhone', 'storeLocation', 'storeHours']) {
    assert.equal(/[<>"]/.test(store.body.user[field]), false, `${field} voltou com HTML: ${store.body.user[field]}`);
  }

  // O autor da avaliação vem do nome do usuário, que acabou de ser editado.
  const review = await call(shared, 'POST', `/api/products/${product.id}/reviews`, { text: '<img src=x onerror=alert(1)>', rating: 4 }, token);
  assert.equal(review.status, 201);
  assert.equal(/[<>]/.test(review.body.review.text), false, `texto da avaliação com HTML: ${review.body.review.text}`);
  assert.equal(/[<>]/.test(review.body.review.author), false, `autor da avaliação com HTML: ${review.body.review.author}`);

  const listed = (await call(shared, 'GET', '/api/products')).body.find((p) => p.id === product.id);
  assert.equal(/[<>]/.test(JSON.stringify(listed.comments)), false);
});

test('imagem da loja só aceita link http(s) ou foto enviada', async () => {
  const { token } = await newUser(shared);
  const bad = await call(shared, 'PUT', '/api/auth/store', { name: 'Loja', storeProfileImage: 'javascript:alert(1)' }, token);
  assert.equal(bad.status, 400);
  const quote = await call(shared, 'PUT', '/api/auth/store', { name: 'Loja', storeCoverImage: 'https://x.com/a.png" onerror="alert(1)' }, token);
  assert.equal(/"/.test(quote.body?.user?.storeCoverImage || ''), false, 'aspa passou para a capa da loja');
  const ok = await call(shared, 'PUT', '/api/auth/store', { name: 'Loja', storeProfileImage: 'https://exemplo.com/a.png' }, token);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.storeProfileImage, 'https://exemplo.com/a.png');
});

test('avaliação com nota 0 fica com nota 0', async () => {
  const { token } = await newUser(shared, { role: 'VENDEDOR' });
  const product = (await call(shared, 'POST', '/api/products', productBody(), token)).body;
  const review = await call(shared, 'POST', `/api/products/${product.id}/reviews`, { text: 'ruim', rating: 0 }, token);
  assert.equal(review.body.review.rating, 0);
});

test('pedido recusa quantidade absurda e nunca grava total que não é número', async () => {
  const { token } = await newUser(shared);
  for (const quantity of [1e308, 100001, 1e20]) {
    const res = await call(shared, 'POST', '/api/orders', { items: [{ id: '1', quantity }] }, token);
    assert.equal(res.status, 400, `quantidade ${quantity} foi aceita`);
  }
  const ok = await call(shared, 'POST', '/api/orders', { items: [{ id: '1', quantity: 3 }] }, token);
  assert.equal(ok.status, 201);
  assert.equal(Number.isFinite(ok.body.total), true);
});

test('o item do pedido não carrega comentários, descrição nem a foto em data URL do produto', async () => {
  const seller = await newUser(shared, { role: 'VENDEDOR' });
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  const product = (await call(shared, 'POST', '/api/products', productBody({ imageUrl: photo }), seller.token)).body;
  await call(shared, 'POST', `/api/products/${product.id}/reviews`, { text: 'boa', rating: 5 }, seller.token);

  const buyer = await newUser(shared);
  const order = await call(shared, 'POST', '/api/orders', { items: [{ id: product.id, quantity: 2 }] }, buyer.token);
  assert.equal(order.status, 201);
  const [item] = order.body.items;
  assert.equal(item.quantity, 2);
  assert.equal(item.name, 'Lote de teste');
  assert.equal(item.price, 100);
  assert.equal(item.ownerEmail, seller.email);
  for (const field of ['comments', 'description', 'image']) {
    assert.equal(field in item, false, `o item do pedido guardou "${field}"`);
  }
});

test('perfil editado do usuário de exemplo continua editado na leitura seguinte', async () => {
  const login = await call(shared, 'POST', '/api/auth/login', { email: 'demo@agrotech.com.br', password: 'demo123' });
  assert.equal(login.status, 200);
  const put = await call(shared, 'PUT', '/api/auth/store', { name: 'Nome Novo', propertyOrCompany: 'Fazenda Nova', storeBio: 'bio nova' }, login.body.token);
  assert.equal(put.status, 200);
  const me = await call(shared, 'GET', '/api/auth/me', undefined, login.body.token);
  assert.equal(me.body.user?.name ?? me.body.name, 'Nome Novo');
  assert.equal(me.body.user?.storeBio ?? me.body.storeBio, 'bio nova');
});

test('ids de usuário e de avaliação são UUID, e não o relógio', async () => {
  const { user, token } = await newUser(shared, { role: 'VENDEDOR' });
  assert.match(user.id, /^usr-[0-9a-f]{8}-[0-9a-f]{4}-/);
  const product = (await call(shared, 'POST', '/api/products', productBody(), token)).body;
  const review = await call(shared, 'POST', `/api/products/${product.id}/reviews`, { text: 'ok', rating: 5 }, token);
  assert.match(review.body.review.id, /^rev-[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test('rota /API em maiúsculas entra na fila: gravações simultâneas não se perdem', async () => {
  const { token } = await newUser(shared);
  const N = 12;
  const results = await Promise.all(Array.from({ length: N }, (_, n) => call(shared, 'POST', '/API/finance/entries', { title: `lançamento ${n}`, amount: 1 + n, type: 'INCOME' }, token)));
  assert.deepEqual(results.map((r) => r.status), Array(N).fill(201));
  const entries = (await call(shared, 'GET', '/api/finance/entries', undefined, token)).body;
  assert.equal(entries.filter((e) => e.source === 'MANUAL').length, N, 'alguma gravação simultânea se perdeu');
});

test('corpo malformado responde 400 e o log não guarda o que o cliente mandou (senha)', async () => {
  const server = await startServer({ capture: true });
  const bad = await call(server, 'POST', '/api/auth/login', '{"password":"senha-secreta-123", x');
  assert.equal(bad.status, 400);
  assert.equal(typeof bad.body?.message, 'string');
  const big = await call(server, 'POST', '/api/auth/login', `{"a":"${'x'.repeat(3 * 1024 * 1024)}"}`);
  assert.equal(big.status, 413);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(server.output().includes('senha-secreta-123'), false, 'a senha apareceu no log do servidor');
});

test('banco ilegível em rota autenticada responde 500, e não "token inválido" (401)', async () => {
  const server = await startServer();
  const { token } = await newUser(server);
  writeFileSync(server.dataFile, '{"users": [ corrompido', 'utf8');
  const res = await call(server, 'GET', '/api/orders', undefined, token);
  assert.equal(res.status, 500);
});

// Guardas de regressão: regras que já estavam certas no servidor e não tinham teste nenhum. Se
// alguém apagar a checagem de dono, ou de ADMIN, qualquer usuário logado passaria a mexer no dos outros.
test('só o dono apaga o anúncio e a avaliação; o ADMIN apaga qualquer um', async () => {
  const owner = await newUser(shared, { role: 'VENDEDOR' });
  const other = await newUser(shared);
  const admin = (await call(shared, 'POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' })).body;

  const product = (await call(shared, 'POST', '/api/products', productBody(), owner.token)).body;
  const review = (await call(shared, 'POST', `/api/products/${product.id}/reviews`, { text: 'boa', rating: 5 }, owner.token)).body.review;

  assert.equal((await call(shared, 'DELETE', `/api/products/${product.id}/reviews/${review.id}`, undefined, other.token)).status, 403);
  assert.equal((await call(shared, 'DELETE', `/api/products/${product.id}`, undefined, other.token)).status, 403);
  assert.equal((await call(shared, 'DELETE', `/api/products/${product.id}`, undefined)).status, 401);

  assert.equal((await call(shared, 'DELETE', `/api/products/${product.id}/reviews/${review.id}`, undefined, admin.token)).status, 204);
  assert.equal((await call(shared, 'DELETE', `/api/products/${product.id}`, undefined, admin.token)).status, 204);
  assert.equal((await call(shared, 'GET', '/api/products')).body.some((p) => p.id === product.id), false);
});

test('pedido e extrato de uma conta não aparecem para outra', async () => {
  const buyer = await newUser(shared);
  const other = await newUser(shared);
  const order = await call(shared, 'POST', '/api/orders', { items: [{ id: '1', quantity: 1 }] }, buyer.token);
  assert.equal(order.status, 201);
  assert.equal((await call(shared, 'GET', '/api/orders', undefined, other.token)).body.some((o) => o.id === order.body.id), false);
  assert.deepEqual((await call(shared, 'GET', '/api/finance/entries', undefined, other.token)).body, []);
});

test('/api/admin/summary só abre para ADMIN', async () => {
  const user = await newUser(shared);
  const admin = (await call(shared, 'POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' })).body;
  assert.equal((await call(shared, 'GET', '/api/admin/summary')).status, 401);
  assert.equal((await call(shared, 'GET', '/api/admin/summary', undefined, user.token)).status, 403);
  const summary = await call(shared, 'GET', '/api/admin/summary', undefined, admin.token);
  assert.equal(summary.status, 200);
  assert.equal(typeof summary.body.revenue, 'number');
});

test('token de usuário que não existe mais é recusado', async () => {
  const server = await startServer();
  const { token } = await newUser(server);
  writeFileSync(server.dataFile, JSON.stringify({ users: [], products: [], orders: [], financeEntries: [] }), 'utf8');
  // O seed do demo e do admin volta sozinho; o usuário do token, não.
  assert.equal((await call(server, 'GET', '/api/orders', undefined, token)).status, 401);
});

test('cupom em minúsculas vale como em maiúsculas; cupom que não existe é ignorado', async () => {
  const { token } = await newUser(shared);
  const order = (coupon) => call(shared, 'POST', '/api/orders', { items: [{ id: '1', quantity: 4 }], coupon }, token);
  const upper = await order('AGRO10');
  const lower = await order('agro10');
  const none = await order(null);
  const bogus = await order('INEXISTENTE');
  assert.equal(lower.body.total, upper.body.total);
  assert.ok(upper.body.total < none.body.total, 'AGRO10 deveria dar desconto');
  assert.equal(bogus.status, 201);
  assert.equal(bogus.body.total, none.body.total);
});
