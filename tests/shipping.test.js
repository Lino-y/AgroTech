// Issue #19 (RF03): frete grátis automático só acima de R$ 800,00. A tela do carrinho anuncia
// "frete grátis por compra acima de R$ 800" pelo resumo (`freeShippingBySubtotal`), não pelo
// frete zerado, que o cupom FRETEGRATIS também zera. Tela no Chrome headless: tests/ui/cart.ui.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCartSummary } from '../src/services/commerce.js';
import { CartEngine } from '../src/modules/cart.js';

const cart = (price) => [{ id: 'p1', price, quantity: 1 }];

test('resumo diz que o frete grátis veio da compra só acima de R$ 800,00, e não do cupom', () => {
  assert.equal(calculateCartSummary(cart(800)).freeShippingBySubtotal, false);
  assert.equal(calculateCartSummary(cart(800.01)).freeShippingBySubtotal, true);
  // Em R$ 800,00 só o cupom zera o frete: isola o efeito dele.
  const coupon = calculateCartSummary(cart(800), 'FRETEGRATIS');
  assert.equal(coupon.shipping, 0);
  assert.equal(coupon.freeShippingBySubtotal, false);
});

test('CartEngine cobra o frete em exatamente R$ 800,00 e zera acima (RF03)', () => {
  const at800 = new CartEngine(cart(800)).calculateTotals();
  assert.equal(at800.freeShipping, false);
  assert.equal(at800.shipping, 35);
  assert.equal(at800.total, 835);
  assert.equal(new CartEngine(cart(800.01)).calculateTotals().shipping, 0);
});
