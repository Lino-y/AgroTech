// Pendências da API do app (#62): senha mínima, estoque no pedido, Idempotency-Key no anúncio,
// versão mínima do app (426) e redefinição de senha por código do ADMIN. Contratos na spec 05.
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
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-pend-'));
  server = await startServer({ env: { DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '', APP_MIN_VERSION: '1.0.0' } });
  base = server.base;
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
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

let seq = 0;
async function newUser(role = 'AMBOS') {
  const email = `pend${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Conta', email, password: 'senha-forte-1', role });
  return { email, token: res.body.token, id: res.body.user.id };
}

const adminToken = async () => (await api('POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' })).body.token;

// --- senha mínima ---

test('cadastro recusa senha com menos de 8 caracteres e aceita 8', async () => {
  const short = await api('POST', '/api/auth/register', { name: 'A', email: `curta${Date.now()}@x.dev`, password: '1234567' });
  assert.equal(short.status, 400);
  assert.match(short.body.message, /8 caracteres/);
  const ok = await api('POST', '/api/auth/register', { name: 'A', email: `ok${Date.now()}@x.dev`, password: '12345678' });
  assert.equal(ok.status, 201);
});

test('login das contas antigas com senha curta continua funcionando (a regra é só no cadastro e na troca)', async () => {
  const res = await api('POST', '/api/auth/login', { email: 'demo@agrotech.com.br', password: 'demo123' });
  assert.equal(res.status, 200);
});

// --- estoque no pedido ---

async function productWithStock(stock) {
  const seller = await newUser('VENDEDOR');
  const res = await api('POST', '/api/products', { name: 'Milho teste', price: 10, category: 'Grãos', description: 'saco', stock }, seller.token);
  assert.equal(res.status, 201);
  return res.body.id;
}

const stockOf = async (id) => (await api('GET', '/api/products')).body.find((p) => p.id === id).stock;

test('pedido acima do estoque é recusado (409) com o produto e quanto há, sem gravar nada', async () => {
  const id = await productWithStock(3);
  const buyer = await newUser();
  const res = await api('POST', '/api/orders', { items: [{ id, quantity: 5 }] }, buyer.token);
  assert.equal(res.status, 409);
  assert.match(res.body.message, /Milho teste/);
  assert.match(res.body.message, /3/);
  assert.equal(await stockOf(id), 3);
  assert.deepEqual((await api('GET', '/api/orders', null, buyer.token)).body, []);
});

test('pedido aceito baixa o estoque; o reenvio com a mesma chave não baixa de novo', async () => {
  const id = await productWithStock(3);
  const buyer = await newUser();
  const headers = { 'Idempotency-Key': 'estoque-chave-0001' };
  const first = await api('POST', '/api/orders', { items: [{ id, quantity: 2 }] }, buyer.token, headers);
  assert.equal(first.status, 201);
  assert.equal(await stockOf(id), 1);
  const again = await api('POST', '/api/orders', { items: [{ id, quantity: 2 }] }, buyer.token, headers);
  assert.equal(again.status, 200);
  assert.equal(await stockOf(id), 1);
});

test('produto sem estoque informado (catálogo de demonstração) não é limitado', async () => {
  const buyer = await newUser();
  const res = await api('POST', '/api/orders', { items: [{ id: '1', quantity: 50 }] }, buyer.token);
  assert.equal(res.status, 201);
});

// --- Idempotency-Key no anúncio ---

const LISTING = { name: 'Soja fila offline', price: 150, category: 'Grãos', description: 'granel' };

test('anúncio com a mesma chave e o mesmo corpo devolve o já criado (200), sem duplicar', async () => {
  const seller = await newUser('VENDEDOR');
  const headers = { 'Idempotency-Key': 'anuncio-chave-0001' };
  const first = await api('POST', '/api/products', LISTING, seller.token, headers);
  assert.equal(first.status, 201);
  const again = await api('POST', '/api/products', LISTING, seller.token, headers);
  assert.equal(again.status, 200);
  assert.equal(again.body.id, first.body.id);
  const mine = (await api('GET', '/api/products')).body.filter((p) => p.name === LISTING.name && p.ownerEmail === seller.email);
  assert.equal(mine.length, 1);
});

test('mesma chave com outro anúncio é 409; chave malformada é 400', async () => {
  const seller = await newUser('VENDEDOR');
  const headers = { 'Idempotency-Key': 'anuncio-chave-0002' };
  assert.equal((await api('POST', '/api/products', LISTING, seller.token, headers)).status, 201);
  const other = await api('POST', '/api/products', { ...LISTING, price: 999 }, seller.token, headers);
  assert.equal(other.status, 409);
  const bad = await api('POST', '/api/products', LISTING, seller.token, { 'Idempotency-Key': 'curta' });
  assert.equal(bad.status, 400);
});

test('a mesma chave em contas diferentes cria dois anúncios (a chave é por dono)', async () => {
  const a = await newUser('VENDEDOR');
  const b = await newUser('VENDEDOR');
  const headers = { 'Idempotency-Key': 'anuncio-chave-0003' };
  const ra = await api('POST', '/api/products', LISTING, a.token, headers);
  const rb = await api('POST', '/api/products', LISTING, b.token, headers);
  assert.equal(ra.status, 201);
  assert.equal(rb.status, 201);
  assert.notEqual(ra.body.id, rb.body.id);
});

test('o catálogo público não mostra a chave nem o hash do anúncio', async () => {
  const products = (await api('GET', '/api/products')).body;
  for (const product of products) {
    assert.equal('idempotencyKey' in product, false);
    assert.equal('requestHash' in product, false);
  }
});

// --- versão mínima do app (APP_MIN_VERSION=1.0.0 neste servidor) ---

test('app com X-App-Version abaixo da mínima recebe 426 com a versão mínima', async () => {
  const res = await api('GET', '/api/products', null, null, { 'X-App-Version': '0.9.9' });
  assert.equal(res.status, 426);
  assert.equal(res.body.minVersion, '1.0.0');
  assert.match(res.body.message, /Atualize/);
  const malformed = await api('GET', '/api/products', null, null, { 'X-App-Version': 'abc' });
  assert.equal(malformed.status, 426, 'versão fora do formato não passa pela checagem');
});

test('versão igual ou maior passa; sem o cabeçalho (a SPA) nunca é bloqueado', async () => {
  assert.equal((await api('GET', '/api/products', null, null, { 'X-App-Version': '1.0.0' })).status, 200);
  assert.equal((await api('GET', '/api/products', null, null, { 'X-App-Version': '1.10.0' })).status, 200);
  assert.equal((await api('GET', '/api/products')).status, 200);
});

test('saúde e configuração do app respondem mesmo para versão antiga', async () => {
  assert.equal((await api('GET', '/api/health', null, null, { 'X-App-Version': '0.1.0' })).status, 200);
  assert.equal((await api('GET', '/api/app-config', null, null, { 'X-App-Version': '0.1.0' })).status, 200);
});

// --- redefinição de senha por código do ADMIN ---

test('só o ADMIN gera código; usuário inexistente é 404', async () => {
  const user = await newUser();
  assert.equal((await api('POST', `/api/admin/users/${user.id}/reset-code`, null, user.token)).status, 403);
  assert.equal((await api('POST', '/api/admin/users/nao-existe/reset-code', null, await adminToken())).status, 404);
});

test('código certo troca a senha, derruba as sessões abertas e não vale de novo', async () => {
  const user = await newUser();
  const gen = await api('POST', `/api/admin/users/${user.id}/reset-code`, null, await adminToken());
  assert.equal(gen.status, 201);
  assert.match(gen.body.code, /^[A-Z0-9]{8}$/);
  assert.ok(Date.parse(gen.body.expiresAt) > Date.now());

  const reset = await api('POST', '/api/auth/reset-password', { email: user.email, code: gen.body.code.toLowerCase(), password: 'nova-senha-123' });
  assert.equal(reset.status, 204);
  assert.equal((await api('GET', '/api/auth/me', null, user.token)).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { email: user.email, password: 'nova-senha-123' })).status, 200);
  assert.equal((await api('POST', '/api/auth/login', { email: user.email, password: 'senha-forte-1' })).status, 401);

  const again = await api('POST', '/api/auth/reset-password', { email: user.email, code: gen.body.code, password: 'outra-senha-123' });
  assert.equal(again.status, 400);
});

test('código errado e e-mail inexistente dão a mesma resposta; senha curta é recusada', async () => {
  const user = await newUser();
  const gen = await api('POST', `/api/admin/users/${user.id}/reset-code`, null, await adminToken());
  const wrongCode = await api('POST', '/api/auth/reset-password', { email: user.email, code: 'ERRADO00', password: 'nova-senha-123' });
  const noEmail = await api('POST', '/api/auth/reset-password', { email: 'ninguem@x.dev', code: gen.body.code, password: 'nova-senha-123' });
  assert.equal(wrongCode.status, 400);
  assert.equal(noEmail.status, 400);
  assert.equal(wrongCode.body.message, noEmail.body.message);
  const short = await api('POST', '/api/auth/reset-password', { email: user.email, code: gen.body.code, password: 'curta' });
  assert.equal(short.status, 400);
  assert.match(short.body.message, /8 caracteres/);
});

test('gerar outro código invalida o anterior', async () => {
  const user = await newUser();
  const admin = await adminToken();
  const first = (await api('POST', `/api/admin/users/${user.id}/reset-code`, null, admin)).body.code;
  const second = (await api('POST', `/api/admin/users/${user.id}/reset-code`, null, admin)).body.code;
  const old = await api('POST', '/api/auth/reset-password', { email: user.email, code: first, password: 'nova-senha-123' });
  assert.equal(old.status, 400);
  const current = await api('POST', '/api/auth/reset-password', { email: user.email, code: second, password: 'nova-senha-123' });
  assert.equal(current.status, 204);
});

test('tentativas erradas de redefinição são limitadas como o login (429)', async () => {
  const user = await newUser();
  let last;
  for (let i = 0; i < 11; i++) {
    last = await api('POST', '/api/auth/reset-password', { email: user.email, code: `ERRO${String(i).padStart(4, '0')}`, password: 'nova-senha-123' });
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
});
