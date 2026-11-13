// Spec 10: fluxos de apps/api/payments.js chamados direto (no mesmo processo), contra o Mercado Pago falso.
// Cobrem caminhos que o teste de ponta a ponta (tests/payments-api.test.js) não alcança: rede fora na
// renovação, notificação de outro tópico ou de vendedor desconhecido, PKCE e configuração inválida.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptToken, readMercadoPagoConfig } from '../apps/api/mercadopago.js';
import {
  applyPayment, completeSellerConnection, PaymentFlowError, preparePayment, processNotification,
  startSellerConnection, sweepPayments, syncOrder
} from '../apps/api/payments.js';
import { startFakeMercadoPago } from './helpers/fake-mercadopago.js';

let mp;
let config;
const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

before(async () => {
  mp = await startFakeMercadoPago();
  config = readMercadoPagoConfig({
    MP_APP_ID: 'app-falso',
    MP_CLIENT_SECRET: crypto.randomBytes(16).toString('hex'),
    MP_OAUTH_REDIRECT_URI: 'https://agrotech.exemplo/api/mp/callback',
    MP_WEBHOOK_SECRET: crypto.randomBytes(16).toString('hex'),
    MP_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
    APP_URL: 'https://agrotech.exemplo/',
    MP_API_BASE: mp.base,
    MP_OAUTH_PKCE: '1'
  });
});

after(() => mp.close());

const emptyDb = () => ({ users: [], products: [], orders: [], sellerAccounts: [], oauthStates: [], settings: {} });

function connectedAccount(expiresInMs = 100 * DAY) {
  return {
    userId: 'u-vend', email: 'vendedor@x.dev', mpUserId: '777', status: 'CONECTADA',
    accessTokenEnc: encryptToken(config.tokenKey, 'token-falso-acesso-antigo'),
    refreshTokenEnc: encryptToken(config.tokenKey, 'token-falso-renovacao-antigo'),
    expiresAt: new Date(NOW + expiresInMs).toISOString()
  };
}

const orderFor = (total = 100) => ({
  id: `AGT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
  total,
  createdAt: new Date(NOW).toISOString(),
  items: [{ id: 'p1', name: 'Milho', quantity: 2 }],
  timeline: [{ title: 'Pedido Confirmado', time: 'Hoje', completed: true }]
});

test('configuração: chave que não tem 32 bytes ou APP_URL que não é http(s) é recusada; padrões oficiais', () => {
  const base = { MP_APP_ID: 'a', MP_CLIENT_SECRET: 'b', MP_OAUTH_REDIRECT_URI: 'c', MP_WEBHOOK_SECRET: 'd', APP_URL: 'https://x.dev' };
  assert.match(readMercadoPagoConfig({ ...base, MP_TOKEN_ENCRYPTION_KEY: 'curta' }).error, /32 bytes/);
  const key = crypto.randomBytes(32).toString('base64');
  assert.match(readMercadoPagoConfig({ ...base, MP_TOKEN_ENCRYPTION_KEY: key, APP_URL: 'ftp://x' }).error, /APP_URL/);
  const ok = readMercadoPagoConfig({ ...base, MP_TOKEN_ENCRYPTION_KEY: key });
  assert.equal(ok.apiBase, 'https://api.mercadopago.com');
  assert.equal(ok.authBase, 'https://auth.mercadopago.com');
  assert.equal(ok.reservationMs, 30 * 60 * 1000);
  assert.deepEqual(readMercadoPagoConfig({}), { mode: 'simulado' });
});

test('PKCE ligado: desafio S256 na URL e verificador na troca do código', async () => {
  const db = emptyDb();
  db.users.push({ id: 'u1', email: 'v@x.dev', role: 'AMBOS' });
  const url = new URL(startSellerConnection(config, db, db.users[0], NOW));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  const verifier = db.oauthStates[0].codeVerifier;
  assert.equal(url.searchParams.get('code_challenge'), crypto.createHash('sha256').update(verifier).digest('base64url'));
  const result = await completeSellerConnection(config, db, { code: 'c', state: url.searchParams.get('state') }, NOW);
  assert.equal(result.status, 200);
  assert.equal(mp.state.tokenRequests.at(-1).form.code_verifier, verifier);
  assert.equal(db.oauthStates.length, 0, 'state consumido');
});

test('state vencido é recusado; perfil que não vende não começa a conexão', async () => {
  const db = emptyDb();
  db.users.push({ id: 'u1', email: 'v@x.dev', role: 'VENDEDOR' });
  const state = new URL(startSellerConnection(config, db, db.users[0], NOW)).searchParams.get('state');
  assert.equal((await completeSellerConnection(config, db, { code: 'c', state }, NOW + 11 * 60 * 1000)).status, 400);
  assert.throws(() => startSellerConnection(config, db, { id: 'u2', role: 'PRODUTOR' }, NOW), PaymentFlowError);
});

test('Mercado Pago fora do alcance na renovação: 502 e o vendedor continua conectado', async () => {
  const offline = { ...config, apiBase: 'http://127.0.0.1:9' };
  const db = emptyDb();
  const account = connectedAccount(DAY);
  db.sellerAccounts.push(account);
  const order = orderFor();
  await assert.rejects(
    preparePayment(offline, db, order, [{ product: { ownerEmail: account.email } }], 'web', NOW),
    (error) => error.status === 502 && !error.persist
  );
  assert.equal(account.status, 'CONECTADA');
});

test('preferência com APP_URL público leva notification_url, auto_return e volta da web', async () => {
  const db = emptyDb();
  db.sellerAccounts.push(connectedAccount());
  db.settings.marketplaceFeePercent = 5;
  const order = orderFor(200);
  await preparePayment(config, db, order, [{ product: { ownerEmail: 'vendedor@x.dev' } }], 'web', NOW);
  const { body, authorization } = mp.state.preferences.at(-1);
  assert.equal(authorization, 'Bearer token-falso-acesso-antigo');
  assert.equal(body.notification_url, 'https://agrotech.exemplo/api/payments/webhook');
  assert.equal(body.auto_return, 'approved');
  assert.equal(body.back_urls.success, `https://agrotech.exemplo/?pedido=${order.id}`);
  assert.equal(body.marketplace_fee, 10);
  assert.equal(order.marketplaceFeeCents, 1000);
  assert.equal(order.reservedUntil, new Date(NOW + config.reservationMs).toISOString());
});

test('pendente com vencimento antes da reserva atual não encurta a reserva; sem data, estende', () => {
  const db = emptyDb();
  const order = { ...orderFor(), paymentStatus: 'AGUARDANDO_PAGAMENTO', reservedUntil: new Date(NOW + DAY).toISOString(), payment: { history: [] } };
  const earlier = { id: 1, status: 'pending', external_reference: order.id, transaction_amount: order.total, collector_id: 777, date_of_expiration: new Date(NOW).toISOString() };
  assert.equal(applyPayment(config, db, order, earlier, 777, 'webhook', NOW), false);
  const undated = { ...earlier, date_of_expiration: null };
  assert.equal(applyPayment(config, db, order, undated, 777, 'webhook', NOW + DAY), true);
  assert.equal(order.reservedUntil, new Date(NOW + DAY + config.reservationMs).toISOString());
});

test('revisão do mesmo pagamento não é marcada duas vezes', () => {
  const db = emptyDb();
  const order = { ...orderFor(), paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { history: [] } };
  const wrong = { id: 5, status: 'approved', external_reference: order.id, transaction_amount: 1, collector_id: 777 };
  assert.equal(applyPayment(config, db, order, wrong, 777, 'webhook', NOW), true);
  assert.equal(applyPayment(config, db, order, wrong, 777, 'webhook', NOW), false);
});

test('notificação de outro tópico ou de vendedor desconhecido não muda nada', async () => {
  const db = emptyDb();
  db.sellerAccounts.push(connectedAccount());
  assert.equal(await processNotification(config, db, { type: 'merchant_order', dataId: '1', userId: '777' }, NOW), false);
  assert.equal(await processNotification(config, db, { type: 'payment', dataId: '1', userId: '999' }, NOW), false);
});

test('notificação de pagamento que não é de pedido do Mercado Pago só renova o token, se precisou', async () => {
  const db = emptyDb();
  db.sellerAccounts.push(connectedAccount());
  mp.state.payments.set('424242', { id: 424242, status: 'approved', external_reference: 'NAO-EXISTE', transaction_amount: 1, collector_id: 777 });
  assert.equal(await processNotification(config, db, { type: 'payment', dataId: '424242', userId: '777' }, NOW), false);
});

test('sync de pedido simulado não faz nada; vendedor desconectado com reserva vencida só cancela', async () => {
  const db = emptyDb();
  assert.equal(await syncOrder(config, db, { id: 'AGT-SIM', payment: undefined }, NOW), false);
  db.products.push({ id: 'p1', stock: 3 });
  const order = { ...orderFor(), paymentStatus: 'AGUARDANDO_PAGAMENTO', sellerEmail: 'sumiu@x.dev', reservedUntil: new Date(NOW - 1).toISOString(), payment: { provider: 'mercadopago', history: [] } };
  db.orders.push(order);
  assert.equal(await syncOrder(config, db, order, NOW), true);
  assert.equal(order.paymentStatus, 'CANCELADO');
  assert.equal(db.products[0].stock, 5, 'reserva de 2 devolvida');
});

test('varredura: pedido recente com reserva válida espera; erro de um pedido não para os outros', async () => {
  const db = emptyDb();
  const account = connectedAccount(DAY);
  db.sellerAccounts.push(account);
  const fresh = { ...orderFor(), paymentStatus: 'AGUARDANDO_PAGAMENTO', sellerEmail: account.email, reservedUntil: new Date(NOW + DAY).toISOString(), payment: { provider: 'mercadopago', history: [] } };
  const stale = { ...orderFor(), createdAt: new Date(NOW - DAY).toISOString(), paymentStatus: 'AGUARDANDO_PAGAMENTO', sellerEmail: account.email, reservedUntil: new Date(NOW + DAY).toISOString(), payment: { provider: 'mercadopago', history: [] } };
  db.orders.push(fresh, stale);
  mp.state.failRefresh = true;
  try {
    const changed = await sweepPayments(config, db, NOW);
    assert.equal(changed, true, 'a desconexão pela renovação recusada é gravada');
  } finally {
    mp.state.failRefresh = false;
  }
  assert.equal(account.status, 'DESCONECTADA');
  assert.equal(fresh.paymentStatus, 'AGUARDANDO_PAGAMENTO');
});
