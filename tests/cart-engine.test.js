// Issue #43: CartEngine não pode ter regra de frete/cupom própria. Para cada carrinho e cupom,
// os totais da classe têm que bater com calculateCartSummary, que é a regra de referência da tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COUPON_RULES, calculateCartSummary } from '../packages/domain/commerce.js';
import { CartEngine } from '../src/modules/cart.js';

const line = (id, price, quantity = 1) => ({ id, price, quantity });
const carts = {
  vazio: [],
  abaixoDoFrete: [line('p1', 149.99)],
  limiteAgro10: [line('p1', 150)],
  limiteNovoCliente: [line('p1', 100)],
  limiteFreteGratis: [line('p1', 400)],
  limite800: [line('p1', 800)],
  acima800: [line('p1', 800.01)],
  mil: [line('p1', 1000)],
  varios: [line('p1', 300, 2), line('p2', 50.5, 3)]
};
const coupons = [null, 'XPTO', ...Object.keys(COUPON_RULES)];
const FIELDS = ['subtotal', 'discount', 'shipping', 'total', 'freeShipping'];

test('totais do CartEngine batem com calculateCartSummary em cada carrinho e cupom', () => {
  for (const [nome, cart] of Object.entries(carts)) {
    for (const coupon of coupons) {
      const engine = new CartEngine(cart);
      engine.appliedCoupon = coupon;
      const totals = engine.calculateTotals();
      const summary = calculateCartSummary(cart, coupon);
      for (const field of FIELDS) {
        assert.equal(totals[field], summary[field], `${nome} + ${coupon}: ${field}`);
      }
    }
  }
});

test('cupom abaixo do valor mínimo não aparece como aplicado no CartEngine', () => {
  const engine = new CartEngine([line('p1', 149.99)]);
  engine.appliedCoupon = 'AGRO10';
  assert.equal(engine.calculateTotals().appliedCoupon, null);
  engine.cart[0].price = 150;
  assert.equal(engine.calculateTotals().appliedCoupon, 'AGRO10');
});
