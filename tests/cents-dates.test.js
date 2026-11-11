// Revisão geral: o resumo do carrinho gravava ruído de ponto flutuante (799.8000000000001) nos pedidos e
// o financeiro o somava; e uma data que não existe (31/Fev) virava 3 de março e caía no mês errado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCartSummary } from '../packages/domain/commerce.js';
import { buildFinanceEntries } from '../packages/domain/finance.js';

test('subtotal, desconto e total saem em centavos exatos, sem ruído de ponto flutuante', () => {
  const cases = [
    { cart: [{ price: 266.6, quantity: 3 }], coupon: null, expected: { subtotal: 799.8, discount: 0, total: 834.8 } },
    { cart: [{ price: 0.1, quantity: 3 }], coupon: null, expected: { subtotal: 0.3, discount: 0, total: 35.3 } },
    { cart: [{ price: 89.9, quantity: 3 }], coupon: 'AGRO10', expected: { subtotal: 269.7, discount: 26.97, total: 277.73 } }
  ];
  for (const { cart, coupon, expected } of cases) {
    const { subtotal, discount, total } = calculateCartSummary(cart, coupon);
    assert.deepEqual({ subtotal, discount, total }, expected, JSON.stringify(cart));
  }
});

test('o limite do frete grátis (R$ 800,00) segue valendo depois de arredondar', () => {
  assert.equal(calculateCartSummary([{ price: 800, quantity: 1 }]).shipping, 35);
  assert.equal(calculateCartSummary([{ price: 800.01, quantity: 1 }]).shipping, 0);
  // 100,01 x 8 soma 800,08 em centavos; o frete é grátis.
  assert.equal(calculateCartSummary([{ price: 100.01, quantity: 8 }]).shipping, 0);
});

test('data que não existe no calendário não entra no financeiro com outra data', () => {
  const order = (date) => ({ id: 'AGT-1', ownerEmail: 'a@b.dev', total: 10, date });
  const dateOf = (date) => buildFinanceEntries({ orders: [order(date)] }, 'a@b.dev')[0].date;
  assert.equal(dateOf('31/Fev/2026'), null);
  assert.equal(dateOf('31/Abr/2026'), null);
  assert.equal(dateOf('29/Fev/2026'), null);
  assert.equal(dateOf('29/Fev/2028'), '2028-02-29T12:00:00.000Z');
  assert.equal(dateOf('15/Set/2026'), '2026-09-15T12:00:00.000Z');
});
