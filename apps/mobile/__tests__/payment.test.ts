// Pagamento pelo Mercado Pago no app (spec 10, parte 3): regras puras do carrinho de um vendedor, do link
// de volta, do link de pagamento e dos botões de cada pedido.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cartSellerProblem,
  entrySourceLabel,
  isSafeCheckoutUrl,
  orderActions,
  parseReturnLink,
  paymentResultMessage,
  sellerConflict
} from '../src/lib/payment.ts';
import type { CartLine } from '../src/lib/cart.ts';
import type { Product } from '../src/services/products.ts';

const p = (id: string, ownerEmail: string, extra: Partial<Product> = {}): Product => ({ id, name: `Produto ${id}`, price: 10, ownerEmail, ...extra });
const line = (product: Product, quantity = 1): CartLine => ({ product, quantity });

test('vendedor diferente do carrinho é conflito; mesmo vendedor ou carrinho vazio, não', () => {
  const lines = [line(p('1', 'a@x.dev'))];
  assert.equal(sellerConflict(lines, p('2', 'b@x.dev')), true);
  assert.equal(sellerConflict(lines, p('3', 'a@x.dev')), false);
  assert.equal(sellerConflict([], p('2', 'b@x.dev')), false);
  assert.equal(sellerConflict([line({ id: '9', name: 'antigo', price: 1 })], p('2', 'b@x.dev')), false, 'carrinho antigo sem dono não bloqueia');
});

test('no fechamento, o vendedor sai do catálogo ao vivo (o carrinho salvo pode não ter o dono)', () => {
  const live = [p('1', 'a@x.dev', { payable: true }), p('2', 'b@x.dev', { payable: true }), p('3', 'c@x.dev', { payable: false })];
  const old = (id: string) => line({ id, name: `Produto ${id}`, price: 10 });
  assert.equal(cartSellerProblem([old('1')], live), null);
  assert.match(cartSellerProblem([old('1'), old('2')], live) ?? '', /mais de um vendedor/);
  assert.match(cartSellerProblem([old('3')], live) ?? '', /Produto 3/);
  assert.match(cartSellerProblem([old('3')], live) ?? '', /ainda não recebe/);
});

test('link de volta: só agrotech://pagamento/retorno com pedido AGT-…', () => {
  assert.equal(parseReturnLink('agrotech://pagamento/retorno?pedido=AGT-B403E9D09B59&collection_status=approved'), 'AGT-B403E9D09B59');
  assert.equal(parseReturnLink('agrotech://pagamento/retorno?collection_id=1&pedido=AGT-00848A53E83E'), 'AGT-00848A53E83E');
  assert.equal(parseReturnLink('agrotech://pagamento/retorno?pedido=<script>'), null);
  assert.equal(parseReturnLink('agrotech://outra/coisa?pedido=AGT-123456'), null);
  assert.equal(parseReturnLink('https://evil.dev/?pedido=AGT-123456'), null);
  assert.equal(parseReturnLink(null), null);
});

test('link de pagamento: só https do Mercado Pago', () => {
  assert.equal(isSafeCheckoutUrl('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1'), true);
  assert.equal(isSafeCheckoutUrl('https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=1'), true);
  assert.equal(isSafeCheckoutUrl('http://www.mercadopago.com.br/checkout'), false);
  assert.equal(isSafeCheckoutUrl('https://mercadopago.com.br.evil.dev/checkout'), false);
  assert.equal(isSafeCheckoutUrl('javascript:alert(1)'), false);
  assert.equal(isSafeCheckoutUrl(undefined), false);
});

test('botões do pedido: aguardando sem pagamento paga e cancela; boleto em andamento só confere; pago, nada', () => {
  const checkoutUrl = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1';
  assert.deepEqual(orderActions({ paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl } }), { pay: true, cancel: true, check: true, note: null });
  const boleto = orderActions({ paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl, mpStatus: 'pending', method: 'ticket' } });
  assert.deepEqual([boleto.pay, boleto.cancel, boleto.check], [false, false, true]);
  assert.match(boleto.note ?? '', /boleto/i);
  assert.deepEqual(orderActions({ paymentStatus: 'PAGO', payment: { checkoutUrl } }), { pay: false, cancel: false, check: false, note: null });
  assert.deepEqual(orderActions({ status: 'Pedido Confirmado' }), { pay: false, cancel: false, check: false, note: null }, 'pedido simulado');
});

test('mensagem depois de conferir: a verdade vem do servidor, nunca do link', () => {
  assert.match(paymentResultMessage({ id: 'AGT-1', paymentStatus: 'PAGO' }).title, /aprovado/);
  assert.match(paymentResultMessage({ id: 'AGT-1', paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { mpStatus: 'pending', method: 'pix' } }).title, /andamento/);
  assert.match(paymentResultMessage({ id: 'AGT-1', paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: {} }).title, /não foi concluído/);
  assert.match(paymentResultMessage({ id: 'AGT-1', paymentStatus: 'CANCELADO' }).title, /cancelado/i);
});

test('origem do lançamento no extrato, inclusive estorno', () => {
  assert.equal(entrySourceLabel('COMPRA'), 'Compra');
  assert.equal(entrySourceLabel('VENDA'), 'Venda');
  assert.equal(entrySourceLabel('ESTORNO'), 'Estorno');
  assert.equal(entrySourceLabel('MANUAL'), 'Manual');
});
