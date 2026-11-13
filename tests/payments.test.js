// Spec 10 (Mercado Pago): regras puras de pagamento (packages/domain/payments.js), extrato com pedido
// pendente e estornado, assinatura do webhook e cifra dos tokens do vendedor (apps/api/mercadopago.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { marketplaceFeeCents, paymentDecision, PAYMENT_STATUS, toCents } from '../packages/domain/payments.js';
import { buildFinanceEntries } from '../packages/domain/finance.js';
import { decryptToken, encryptToken, verifyWebhookSignature } from '../apps/api/mercadopago.js';

const { AGUARDANDO, PAGO, CANCELADO, ESTORNADO } = PAYMENT_STATUS;

// --- comissão (RF-07) ---

test('comissão: percentual em centavos, arredondada para baixo, nunca o total inteiro', () => {
  assert.equal(marketplaceFeeCents(10000, 0), 0);
  assert.equal(marketplaceFeeCents(10000, 30), 3000, 'teto de 30%');
  assert.equal(marketplaceFeeCents(1999, 12.5), 249, '249,875 centavos vira 249');
  assert.equal(marketplaceFeeCents(10000, 0.29), 29, 'sem erro de ponto flutuante (0,29 * 100 = 28,999...)');
  assert.equal(marketplaceFeeCents(1, 30), 0, 'total de R$ 0,01 não paga comissão');
  assert.equal(marketplaceFeeCents(2, 30), 0);
  assert.throws(() => marketplaceFeeCents(10000, 30.01), RangeError);
  assert.throws(() => marketplaceFeeCents(10000, -1), RangeError);
});

test('reais para centavos sem erro de ponto flutuante', () => {
  assert.equal(toCents(89.9), 8990);
  assert.equal(toCents(0.1 + 0.2), 30);
});

// --- estado do pedido pelo pagamento consultado (RF-04) ---

const order = (paymentStatus, extra = {}) => ({ id: 'AGT-1', total: 150.5, paymentStatus, payment: { paymentId: '55' }, ...extra });
const payment = (status, extra = {}) => ({ id: 55, status, external_reference: 'AGT-1', transaction_amount: 150.5, collector_id: 777, ...extra });

test('aprovado paga o pedido aguardando; repetir não muda nada', () => {
  assert.deepEqual(paymentDecision(order(AGUARDANDO), payment('approved'), 777), { to: PAGO });
  assert.deepEqual(paymentDecision(order(PAGO), payment('approved'), 777), {});
});

test('valor, referência ou recebedor diferentes não mudam o pedido e pedem revisão', () => {
  assert.match(paymentDecision(order(AGUARDANDO), payment('approved', { transaction_amount: 150.49 }), 777).review, /valor/);
  assert.match(paymentDecision(order(AGUARDANDO), payment('approved', { external_reference: 'AGT-2' }), 777).review, /referência/);
  assert.match(paymentDecision(order(AGUARDANDO), payment('approved', { collector_id: 1 }), 777).review, /recebedor/);
});

test('recusado não cancela: o comprador pode tentar outro meio até a reserva vencer', () => {
  assert.deepEqual(paymentDecision(order(AGUARDANDO), payment('rejected'), 777), {});
  assert.deepEqual(paymentDecision(order(AGUARDANDO), payment('cancelled'), 777), {});
});

test('pendente (boleto, Pix) segura a reserva até o vencimento do pagamento', () => {
  const due = '2026-11-15T23:59:59.000-03:00';
  assert.deepEqual(paymentDecision(order(AGUARDANDO), payment('pending', { date_of_expiration: due }), 777), { holdUntil: due });
  assert.deepEqual(paymentDecision(order(AGUARDANDO), payment('in_process'), 777), { holdUntil: null });
});

test('estorno só vale para o pagamento que pagou o pedido', () => {
  assert.deepEqual(paymentDecision(order(PAGO), payment('refunded'), 777), { to: ESTORNADO });
  assert.deepEqual(paymentDecision(order(PAGO), payment('charged_back'), 777), { to: ESTORNADO });
  assert.deepEqual(paymentDecision(order(PAGO), payment('refunded', { id: 99 }), 777), {}, 'outro pagamento');
});

test('aprovado depois de cancelado vira revisão do ADMIN, não ressuscita o pedido', () => {
  assert.match(paymentDecision(order(CANCELADO), payment('approved'), 777).review, /cancelado/);
});

test('o pagamento em revisão, estornado, resolve a revisão (RF-08); outro pagamento estornado não', () => {
  const reviewed = order(CANCELADO, { paymentReview: { reason: 'aprovado depois do cancelamento', paymentId: '55' } });
  assert.deepEqual(paymentDecision(reviewed, payment('refunded'), 777), { resolveReview: true });
  const divergent = order(AGUARDANDO, { paymentReview: { reason: 'valor', paymentId: '55' } });
  assert.deepEqual(paymentDecision(divergent, payment('refunded', { transaction_amount: 1 }), 777), { resolveReview: true }, 'mesmo com valor divergente');
  assert.deepEqual(paymentDecision(reviewed, payment('refunded', { id: 99 }), 777), {});
  const resolved = order(CANCELADO, { paymentReview: { reason: 'x', paymentId: '55', resolvedAt: '2026-11-13T00:00:00Z' } });
  assert.deepEqual(paymentDecision(resolved, payment('refunded'), 777), {}, 'já resolvida');
});

// --- extrato (RF-09) ---

test('extrato: pedido aguardando ou cancelado não entra; estornado entra e é desfeito', () => {
  const base = { ownerEmail: 'comprador@x.dev', createdAt: '2026-11-10T12:00:00.000Z', total: 100, items: [{ ownerEmail: 'vendedor@x.dev', price: 100, quantity: 1 }] };
  const orders = [
    { ...base, id: 'P-AG', paymentStatus: AGUARDANDO },
    { ...base, id: 'P-CA', paymentStatus: CANCELADO },
    { ...base, id: 'P-PG', paymentStatus: PAGO },
    { ...base, id: 'P-ES', paymentStatus: ESTORNADO },
    { ...base, id: 'P-ANTIGO', status: 'Pedido Confirmado' }
  ];
  const buyer = buildFinanceEntries({ orders }, 'comprador@x.dev').map((e) => `${e.id}:${e.type}`).sort();
  assert.deepEqual(buyer, ['compra-P-ANTIGO:EXPENSE', 'compra-P-ES:EXPENSE', 'compra-P-PG:EXPENSE', 'estorno-P-ES:INCOME']);
  const seller = buildFinanceEntries({ orders }, 'vendedor@x.dev').map((e) => `${e.id}:${e.type}`).sort();
  assert.deepEqual(seller, ['estorno-P-ES:EXPENSE', 'venda-P-ANTIGO:INCOME', 'venda-P-ES:INCOME', 'venda-P-PG:INCOME']);
});

// --- assinatura do webhook (RF-04) ---

const SECRET = 'segredo-de-teste-do-webhook';
function signed({ dataId = '123456', requestId = 'req-1', ts = Math.floor(Date.now() / 1000) } = {}) {
  const v1 = crypto.createHmac('sha256', SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return { xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId, dataId, secret: SECRET };
}

test('assinatura válida passa; qualquer peça trocada é recusada', () => {
  assert.equal(verifyWebhookSignature(signed()), 'ok');
  assert.equal(verifyWebhookSignature({ ...signed(), dataId: '654321' }), 'invalid');
  assert.equal(verifyWebhookSignature({ ...signed(), xRequestId: 'req-2' }), 'invalid');
  assert.equal(verifyWebhookSignature({ ...signed(), secret: 'outro' }), 'invalid');
});

test('assinatura sem as peças é malformada; ts com mais de 5 minutos é recusado', () => {
  assert.equal(verifyWebhookSignature({ ...signed(), xSignature: '' }), 'missing');
  assert.equal(verifyWebhookSignature({ ...signed(), xRequestId: '' }), 'missing');
  assert.equal(verifyWebhookSignature({ ...signed(), dataId: '' }), 'missing');
  const old = Math.floor(Date.now() / 1000) - 6 * 60;
  assert.equal(verifyWebhookSignature(signed({ ts: old })), 'invalid');
});

test('ts em milissegundos também é aceito (a documentação mostra segundos)', () => {
  assert.equal(verifyWebhookSignature(signed({ ts: Date.now() })), 'ok');
});

test('data.id alfanumérico é comparado em minúsculas', () => {
  const sig = signed({ dataId: 'abc123' });
  assert.equal(verifyWebhookSignature({ ...sig, dataId: 'ABC123' }), 'ok');
});

// --- cifra dos tokens do vendedor (RF-01) ---

test('token do vendedor cifrado: volta igual com a chave certa e falha se alterado', () => {
  const key = crypto.randomBytes(32);
  const sealed = encryptToken(key, 'token-falso-do-vendedor');
  assert.doesNotMatch(sealed, /token-falso/);
  assert.equal(decryptToken(key, sealed), 'token-falso-do-vendedor');
  const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
  assert.throws(() => decryptToken(key, tampered));
  assert.throws(() => decryptToken(crypto.randomBytes(32), sealed));
});
