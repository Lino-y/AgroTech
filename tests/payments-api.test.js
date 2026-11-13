// Spec 10, parte 1: API dos pedidos pelo Mercado Pago. Sobe o server.js de verdade (banco descartável)
// contra um Mercado Pago falso local (tests/helpers/fake-mercadopago.js). Cobre OAuth do vendedor,
// preferência com comissão, webhook assinado, sync, reserva de estoque, varredura e extrato.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from './helpers/start-server.js';
import { startFakeMercadoPago } from './helpers/fake-mercadopago.js';

// Segredos gerados a cada execução: nenhum valor de credencial fica escrito no repositório.
const WEBHOOK_SECRET = crypto.randomBytes(16).toString('hex');
let mp;
let server;
let base;
let dataDir;

const mpEnv = (extra = {}) => ({
  MP_APP_ID: 'app-falso',
  MP_CLIENT_SECRET: crypto.randomBytes(16).toString('hex'),
  MP_OAUTH_REDIRECT_URI: 'http://localhost/api/mp/callback',
  MP_WEBHOOK_SECRET: WEBHOOK_SECRET,
  MP_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  APP_URL: 'http://localhost:9',
  MP_API_BASE: mp.base,
  MP_AUTH_BASE: 'https://auth.mercadopago.test',
  JWT_SECRET: '',
  ...extra
});

before(async () => {
  mp = await startFakeMercadoPago();
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-mp-'));
  server = await startServer({ env: mpEnv({ DATA_FILE: path.join(dataDir, 'db.json') }) });
  base = server.base;
});

after(async () => {
  server.kill();
  await mp.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function api(method, url, body, token, headers = {}, at = base) {
  const res = await fetch(at + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, text };
}

let seq = 0;
async function newUser(role, at = base) {
  const email = `mp${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Conta', email, password: 'senha-forte-1', role }, null, {}, at);
  return { email, token: res.body.token, id: res.body.user.id };
}

async function connectSeller(at = base) {
  const seller = await newUser('VENDEDOR', at);
  const start = await api('POST', '/api/mp/connect', null, seller.token, {}, at);
  assert.equal(start.status, 200);
  const state = new URL(start.body.url).searchParams.get('state');
  const done = await api('GET', `/api/mp/callback?code=codigo-falso&state=${state}`, null, null, {}, at);
  assert.equal(done.status, 200, done.text);
  return { ...seller, mpUserId: mp.state.lastUserId, state };
}

async function newProduct(seller, { price = 50, stock = 10 } = {}, at = base) {
  const res = await api('POST', '/api/products', { name: 'Semente teste', price, category: 'Sementes', description: 'saco', stock }, seller.token, {}, at);
  assert.equal(res.status, 201);
  return res.body.id;
}

const stockOf = async (id, at = base) => (await api('GET', '/api/products', null, null, {}, at)).body.find((p) => p.id === id).stock;
const placeOrder = (buyer, items, key = crypto.randomUUID(), at = base) =>
  api('POST', '/api/orders', { items, returnTo: 'app' }, buyer.token, { 'Idempotency-Key': key }, at);
const orderOf = async (buyer, id, at = base) => (await api('GET', '/api/orders', null, buyer.token, {}, at)).body.find((o) => o.id === id);

function signedHeaders(dataId, requestId = crypto.randomUUID()) {
  const ts = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

const notify = (paymentId, userId, headers = signedHeaders(String(paymentId))) =>
  api('POST', `/api/payments/webhook?data.id=${paymentId}&type=payment`, { type: 'payment', action: 'payment.updated', data: { id: String(paymentId) }, user_id: userId }, null, headers);

// O webhook responde 200 e processa depois: o teste espera o efeito. Até 15 s, porque com a suíte inteira
// em paralelo e a cobertura ligada o servidor fica lento; termina assim que o estado muda. Na falha, o fim
// do log do servidor diz se foi lentidão ou erro no processamento.
async function waitFor(check, what) {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`esperou demais: ${what}\n--- log do servidor ---\n${server.output().slice(-1500)}`);
}

let paymentSeq = 900000;
function fakePayment(order, sellerMpId, status, extra = {}) {
  const payment = { id: ++paymentSeq, status, external_reference: order.id, transaction_amount: order.total, collector_id: sellerMpId, payment_type_id: 'pix', ...extra };
  mp.state.payments.set(String(payment.id), payment);
  return payment;
}

// --- configuração ---

test('Mercado Pago configurado pela metade não sobe (e diz o que falta)', async () => {
  await assert.rejects(startServer({ env: { MP_APP_ID: 'so-isso', DATA_FILE: path.join(dataDir, 'meia.json') } }), /faltam .*MP_WEBHOOK_SECRET/);
});

// --- OAuth do vendedor (RF-01) ---

test('conectar: URL de autorização oficial com state; state vale uma vez; tokens nunca saem da API', async () => {
  const seller = await newUser('VENDEDOR');
  const start = await api('POST', '/api/mp/connect', null, seller.token);
  const url = new URL(start.body.url);
  assert.equal(url.origin + url.pathname, 'https://auth.mercadopago.test/authorization');
  assert.equal(url.searchParams.get('platform_id'), 'mp');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost/api/mp/callback');
  const state = url.searchParams.get('state');
  assert.match(state, /^[a-f0-9]{64}$/);

  assert.equal((await api('GET', '/api/mp/callback?code=x&state=forjado')).status, 400);
  const ok = await api('GET', `/api/mp/callback?code=codigo-falso&state=${state}`);
  assert.equal(ok.status, 200);
  assert.equal(mp.state.tokenRequests.at(-1).form.grant_type, 'authorization_code');
  assert.equal(mp.state.tokenRequests.at(-1).contentType, 'application/x-www-form-urlencoded');
  assert.equal((await api('GET', `/api/mp/callback?code=codigo-falso&state=${state}`)).status, 400, 'state reutilizado');

  const status = await api('GET', '/api/mp/status', null, seller.token);
  assert.deepEqual(Object.keys(status.body).sort(), ['connected', 'expiresAt']);
  assert.equal(status.body.connected, true);
  assert.doesNotMatch(status.text + ok.text, /token-falso/);
  assert.doesNotMatch(readFileSync(path.join(dataDir, 'db.json'), 'utf8'), /token-falso/, 'token cifrado em repouso');
});

test('callback com erro do Mercado Pago ou sem código é recusado e consome o state', async () => {
  const seller = await newUser('VENDEDOR');
  const state = new URL((await api('POST', '/api/mp/connect', null, seller.token)).body.url).searchParams.get('state');
  const denied = await api('GET', `/api/mp/callback?error=access_denied&state=${state}`);
  assert.equal(denied.status, 400);
  assert.equal((await api('GET', `/api/mp/callback?code=x&state=${state}`)).status, 400);
});

test('só vendedor conecta conta; desconectar apaga a conexão', async () => {
  const buyer = await newUser('PRODUTOR');
  assert.equal((await api('POST', '/api/mp/connect', null, buyer.token)).status, 403);
  const seller = await connectSeller();
  assert.equal((await api('DELETE', '/api/mp/connect', null, seller.token)).status, 204);
  assert.equal((await api('GET', '/api/mp/status', null, seller.token)).body.connected, false);
});

test('conexão do vendedor sobrevive a gravação de outra rota (readDb não descarta a coleção)', async () => {
  const seller = await connectSeller();
  await api('POST', '/api/finance/entries', { title: 'Diesel', amount: 10, type: 'EXPENSE' }, seller.token);
  assert.equal((await api('GET', '/api/mp/status', null, seller.token)).body.connected, true);
});

// --- comissão (RF-07) ---

test('comissão: só ADMIN define, de 0 a 30%', async () => {
  const admin = (await api('POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' })).body.token;
  const buyer = await newUser('PRODUTOR');
  assert.equal((await api('PUT', '/api/admin/settings', { marketplaceFeePercent: 10 }, buyer.token)).status, 403);
  assert.equal((await api('PUT', '/api/admin/settings', { marketplaceFeePercent: 30.01 }, admin)).status, 400);
  assert.equal((await api('PUT', '/api/admin/settings', { marketplaceFeePercent: 'dez' }, admin)).status, 400);
  const ok = await api('PUT', '/api/admin/settings', { marketplaceFeePercent: 10 }, admin);
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/api/admin/settings', null, admin)).body.marketplaceFeePercent, 10);
  await api('PUT', '/api/admin/settings', { marketplaceFeePercent: 0 }, admin);
});

// --- pedido (RF-02, RF-03, RF-05) ---

test('pedido com itens de dois vendedores é recusado (400); vendedor sem conta conectada, 409', async () => {
  const buyer = await newUser('PRODUTOR');
  const a = await newProduct(await connectSeller());
  const b = await newProduct(await connectSeller());
  assert.equal((await placeOrder(buyer, [{ id: a, quantity: 1 }, { id: b, quantity: 1 }])).status, 400);
  const notConnected = await newProduct(await newUser('VENDEDOR'));
  const res = await placeOrder(buyer, [{ id: notConnected, quantity: 1 }]);
  assert.equal(res.status, 409);
  assert.match(res.body.message, /Mercado Pago/);
});

test('pedido cria a preferência com o token do vendedor, total e comissão do servidor; estoque reservado', async () => {
  const admin = (await api('POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' })).body.token;
  await api('PUT', '/api/admin/settings', { marketplaceFeePercent: 10 }, admin);
  const seller = await connectSeller();
  const id = await newProduct(seller, { price: 333.33, stock: 5 });
  const buyer = await newUser('PRODUTOR');
  const key = crypto.randomUUID();

  const res = await placeOrder(buyer, [{ id, quantity: 3 }], key);
  assert.equal(res.status, 201, res.text);
  assert.equal(res.body.paymentStatus, 'AGUARDANDO_PAGAMENTO');
  assert.equal(res.body.status, 'Aguardando pagamento');
  assert.match(res.body.payment.checkoutUrl, /^https:\/\/mercadopago\.test\/checkout/);
  assert.equal(await stockOf(id), 2, 'reserva baixa o estoque');

  const pref = mp.state.preferences.at(-1);
  assert.match(pref.authorization, /^Bearer token-falso-acesso-\d+$/);
  assert.equal(pref.idempotencyKey, res.body.id);
  assert.equal(pref.body.external_reference, res.body.id);
  assert.equal(pref.body.items.length, 1);
  assert.equal(pref.body.items[0].unit_price, res.body.total, 'um item com o total (frete e cupom inclusos)');
  assert.equal(pref.body.marketplace_fee, Math.floor(res.body.total * 100 * 0.1) / 100);
  assert.equal(pref.body.collector_id, undefined);
  assert.equal(pref.body.notification_url, undefined, 'APP_URL local: sem notification_url (o Mercado Pago recusa)');
  assert.equal(pref.body.auto_return, undefined);
  assert.match(pref.body.back_urls.success, /^agrotech:\/\/pagamento\/retorno/);

  const before = mp.state.preferences.length;
  const replay = await placeOrder(buyer, [{ id, quantity: 3 }], key);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.id, res.body.id);
  assert.equal(mp.state.preferences.length, before, 'reenvio não cria segunda preferência');
  await api('PUT', '/api/admin/settings', { marketplaceFeePercent: 0 }, admin);
});

test('Mercado Pago fora do ar: 502 e nada gravado (nem pedido, nem reserva)', async () => {
  const seller = await connectSeller();
  const id = await newProduct(seller, { stock: 4 });
  const buyer = await newUser('PRODUTOR');
  mp.state.failPreferences = true;
  try {
    const res = await placeOrder(buyer, [{ id, quantity: 1 }]);
    assert.equal(res.status, 502);
  } finally {
    mp.state.failPreferences = false;
  }
  assert.equal(await stockOf(id), 4);
  assert.deepEqual((await api('GET', '/api/orders', null, buyer.token)).body, []);
});

// --- webhook e estados (RF-04) ---

async function pendingOrder({ price = 80, stock = 10, quantity = 2 } = {}) {
  const seller = await connectSeller();
  const productId = await newProduct(seller, { price, stock });
  const buyer = await newUser('PRODUTOR');
  const res = await placeOrder(buyer, [{ id: productId, quantity }]);
  assert.equal(res.status, 201, res.text);
  return { seller, buyer, productId, order: res.body };
}

test('webhook: sem assinatura 400, assinatura errada 401, nada muda', async () => {
  const { seller, buyer, order } = await pendingOrder();
  const payment = fakePayment(order, seller.mpUserId, 'approved');
  assert.equal((await notify(payment.id, seller.mpUserId, {})).status, 400);
  const bad = signedHeaders(String(payment.id));
  bad['x-signature'] = bad['x-signature'].replace(/v1=./, 'v1=0');
  assert.equal((await notify(payment.id, seller.mpUserId, bad)).status, 401);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal((await orderOf(buyer, order.id)).paymentStatus, 'AGUARDANDO_PAGAMENTO');
});

test('webhook aprovado paga o pedido; a mesma notificação de novo não muda nada', async () => {
  const { seller, buyer, order } = await pendingOrder();
  const payment = fakePayment(order, seller.mpUserId, 'approved');
  assert.equal((await notify(payment.id, seller.mpUserId)).status, 200);
  await waitFor(async () => (await orderOf(buyer, order.id)).paymentStatus === 'PAGO', 'pedido pago');
  const paid = await orderOf(buyer, order.id);
  assert.equal(paid.status, 'Pedido Confirmado');
  assert.equal(paid.payment.paymentId, String(payment.id));
  await notify(payment.id, seller.mpUserId);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal((await orderOf(buyer, order.id)).payment.history.length, paid.payment.history.length);
});

test('webhook que não consegue consultar o pagamento responde 500 (o Mercado Pago reenvia) e o reenvio aplica', async () => {
  const { seller, buyer, order } = await pendingOrder();
  const payment = { id: 777000 + Math.floor(Math.random() * 1000), status: 'approved', external_reference: order.id, transaction_amount: order.total, collector_id: seller.mpUserId };
  const first = await notify(payment.id, seller.mpUserId);
  assert.equal(first.status, 500, 'pagamento ainda não visível no Mercado Pago');
  assert.equal((await orderOf(buyer, order.id)).paymentStatus, 'AGUARDANDO_PAGAMENTO');
  mp.state.payments.set(String(payment.id), payment);
  assert.equal((await notify(payment.id, seller.mpUserId)).status, 200);
  assert.equal((await orderOf(buyer, order.id)).paymentStatus, 'PAGO', 'responde 200 só depois de gravar');
});

test('webhook com valor divergente não paga e marca revisão', async () => {
  const { seller, buyer, order } = await pendingOrder();
  const payment = fakePayment(order, seller.mpUserId, 'approved', { transaction_amount: order.total - 1 });
  await notify(payment.id, seller.mpUserId);
  await waitFor(async () => Boolean((await orderOf(buyer, order.id)).paymentReview), 'revisão marcada');
  assert.equal((await orderOf(buyer, order.id)).paymentStatus, 'AGUARDANDO_PAGAMENTO');
});

test('estorno depois de pago: ESTORNADO e estoque devolvido uma vez só', async () => {
  const { seller, buyer, order, productId } = await pendingOrder({ stock: 10, quantity: 3 });
  const payment = fakePayment(order, seller.mpUserId, 'approved');
  await notify(payment.id, seller.mpUserId);
  await waitFor(async () => (await orderOf(buyer, order.id)).paymentStatus === 'PAGO', 'pago');
  assert.equal(await stockOf(productId), 7);
  payment.status = 'refunded';
  await notify(payment.id, seller.mpUserId);
  await waitFor(async () => (await orderOf(buyer, order.id)).paymentStatus === 'ESTORNADO', 'estornado');
  await notify(payment.id, seller.mpUserId);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(await stockOf(productId), 10);
});

test('sync pela volta do app aplica o pagamento sem webhook; só o dono ou o ADMIN sincroniza', async () => {
  const { seller, buyer, order } = await pendingOrder();
  fakePayment(order, seller.mpUserId, 'rejected');
  fakePayment(order, seller.mpUserId, 'approved');
  const other = await newUser('PRODUTOR');
  assert.equal((await api('POST', `/api/orders/${order.id}/sync`, null, other.token)).status, 404);
  const res = await api('POST', `/api/orders/${order.id}/sync`, null, buyer.token);
  assert.equal(res.status, 200);
  assert.equal(res.body.paymentStatus, 'PAGO', 'recusado antes do aprovado não cancela');
});

test('extrato: pedido aguardando pagamento não entra; pago entra', async () => {
  const { seller, buyer, order } = await pendingOrder();
  const ids = async () => (await api('GET', '/api/finance/entries', null, buyer.token)).body.map((e) => e.id);
  assert.equal((await ids()).includes(`compra-${order.id}`), false);
  fakePayment(order, seller.mpUserId, 'approved');
  await api('POST', `/api/orders/${order.id}/sync`, null, buyer.token);
  assert.equal((await ids()).includes(`compra-${order.id}`), true);
});

test('excluir a conta do vendedor apaga a conexão Mercado Pago dele', async () => {
  const seller = await connectSeller();
  assert.equal((await api('DELETE', '/api/auth/me', { password: 'senha-forte-1' }, seller.token)).status, 204);
  const db = JSON.parse(readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(db.sellerAccounts.some((account) => account.email === seller.email), false);
});

test('token perto de vencer é renovado antes da preferência; renovação recusada desconecta (409)', async () => {
  mp.state.expiresIn = 60;
  const seller = await connectSeller();
  mp.state.expiresIn = undefined;
  const id = await newProduct(seller);
  const buyer = await newUser('PRODUTOR');
  const res = await placeOrder(buyer, [{ id, quantity: 1 }]);
  assert.equal(res.status, 201, res.text);
  assert.equal(mp.state.tokenRequests.at(-1).form.grant_type, 'refresh_token');
  const renewed = mp.state.tokenRequests.length;
  assert.equal(mp.state.preferences.at(-1).authorization, `Bearer token-falso-acesso-${renewed}`);

  mp.state.expiresIn = 60;
  const expiring = await connectSeller();
  mp.state.expiresIn = undefined;
  const other = await newProduct(expiring);
  mp.state.failRefresh = true;
  try {
    assert.equal((await placeOrder(buyer, [{ id: other, quantity: 1 }])).status, 409);
  } finally {
    mp.state.failRefresh = false;
  }
  assert.equal((await api('GET', '/api/mp/status', null, expiring.token)).body.connected, false);
});

// --- estorno pelo ADMIN (RF-08) ---

const adminToken = async () => (await api('POST', '/api/auth/login', { email: 'admin@agrotech.com.br', password: 'admin123' })).body.token;

async function paidOrder() {
  const ctx = await pendingOrder({ stock: 10, quantity: 2 });
  const payment = fakePayment(ctx.order, ctx.seller.mpUserId, 'approved');
  await api('POST', `/api/orders/${ctx.order.id}/sync`, null, ctx.buyer.token);
  assert.equal((await orderOf(ctx.buyer, ctx.order.id)).paymentStatus, 'PAGO');
  return { ...ctx, payment };
}

test('estorno: só o ADMIN; pedido aguardando não tem o que estornar (409)', async () => {
  const { buyer, order } = await pendingOrder();
  assert.equal((await api('POST', `/api/admin/orders/${order.id}/refund`, null, buyer.token)).status, 403);
  assert.equal((await api('POST', `/api/admin/orders/${order.id}/refund`, null, await adminToken())).status, 409);
  assert.equal((await api('POST', '/api/admin/orders/AGT-NAOEXISTE/refund', null, await adminToken())).status, 404);
});

test('estorno de pedido pago: pede ao Mercado Pago com o token do vendedor; confirmado, ESTORNADO e estoque de volta', async () => {
  const { buyer, order, payment, productId } = await paidOrder();
  assert.equal(await stockOf(productId), 8);
  const res = await api('POST', `/api/admin/orders/${order.id}/refund`, null, await adminToken());
  assert.equal(res.status, 202, res.text);
  assert.match(res.body.message, /proporcional/);
  const call = mp.state.refundRequests.at(-1);
  assert.equal(call.paymentId, String(payment.id));
  assert.match(call.authorization, /^Bearer token-falso-acesso-\d+$/);
  assert.equal(call.idempotencyKey, `estorno-${payment.id}`);
  assert.equal(res.body.order.paymentStatus, 'ESTORNADO');
  assert.equal((await orderOf(buyer, order.id)).refundRequest.paymentId, String(payment.id));
  assert.equal(await stockOf(productId), 10);
});

test('estorno aceito mas ainda não confirmado não muda o pedido', async () => {
  const { buyer, order } = await paidOrder();
  mp.state.refundPending = true;
  try {
    const res = await api('POST', `/api/admin/orders/${order.id}/refund`, null, await adminToken());
    assert.equal(res.status, 202);
  } finally {
    mp.state.refundPending = false;
  }
  assert.equal((await orderOf(buyer, order.id)).paymentStatus, 'PAGO');
});

test('Mercado Pago recusa o estorno (ex.: vendedor sem saldo): 409 e nada muda', async () => {
  const { buyer, order } = await paidOrder();
  mp.state.failRefund = true;
  try {
    const res = await api('POST', `/api/admin/orders/${order.id}/refund`, null, await adminToken());
    assert.equal(res.status, 409);
    assert.match(res.body.message, /painel do Mercado Pago/);
  } finally {
    mp.state.failRefund = false;
  }
  assert.equal((await orderOf(buyer, order.id)).paymentStatus, 'PAGO');
});

test('pagamento em revisão (valor divergente): o estorno devolve esse pagamento e resolve a revisão', async () => {
  const { seller, buyer, order } = await pendingOrder();
  // Pagamento em revisão deixa dinheiro com o vendedor sem pagar o pedido. O caso "aprovado depois do
  // cancelamento" segue a mesma regra (tests/payments.test.js, revisão resolvida pelo estorno).
  const wrong = fakePayment(order, seller.mpUserId, 'approved', { transaction_amount: order.total + 5 });
  await api('POST', `/api/orders/${order.id}/sync`, null, buyer.token);
  assert.equal((await orderOf(buyer, order.id)).paymentReview.paymentId, String(wrong.id));
  const res = await api('POST', `/api/admin/orders/${order.id}/refund`, null, await adminToken());
  assert.equal(res.status, 202, res.text);
  assert.equal(mp.state.refundRequests.at(-1).paymentId, String(wrong.id));
  const after = await orderOf(buyer, order.id);
  assert.ok(after.paymentReview.resolvedAt, 'revisão resolvida pelo estorno');
  assert.equal(after.paymentStatus, 'AGUARDANDO_PAGAMENTO', 'o pedido em si não foi pago');
});

// --- varredura (RF-05), num servidor com reserva curta ---

test('varredura: reserva vencida sem pagamento cancela e devolve o estoque; pendente segura', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agrotech-mp-sweep-'));
  const quick = await startServer({ env: mpEnv({ DATA_FILE: path.join(dir, 'db.json'), MP_RESERVATION_MS: '400', MP_SWEEP_MS: '150' }) });
  try {
    const seller = await connectSeller(quick.base);
    const productId = await newProduct(seller, { stock: 10 }, quick.base);
    const buyer = await newUser('PRODUTOR', quick.base);
    const abandoned = (await placeOrder(buyer, [{ id: productId, quantity: 2 }], undefined, quick.base)).body;
    const boleto = (await placeOrder(buyer, [{ id: productId, quantity: 3 }], undefined, quick.base)).body;
    const due = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    fakePayment(boleto, seller.mpUserId, 'pending', { date_of_expiration: due, payment_type_id: 'ticket' });
    assert.equal(await stockOf(productId, quick.base), 5);

    await waitFor(async () => (await orderOf(buyer, abandoned.id, quick.base)).paymentStatus === 'CANCELADO', 'cancelado na varredura');
    // O pedido de boleto foi criado depois: a reserva dele pode vencer numa passada seguinte da varredura.
    await waitFor(async () => (await orderOf(buyer, boleto.id, quick.base)).reservedUntil === due, 'reserva do boleto estendida');
    assert.equal(await stockOf(productId, quick.base), 7, 'só a reserva do pedido abandonado volta');
    const held = await orderOf(buyer, boleto.id, quick.base);
    assert.equal(held.paymentStatus, 'AGUARDANDO_PAGAMENTO');
    assert.equal(held.reservedUntil, due);
  } finally {
    quick.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
