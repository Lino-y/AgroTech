import test from 'node:test';
import assert from 'node:assert/strict';
import { COUPON_RULES, validateCouponCode } from '../src/services/commerce.js';
import { CartEngine } from '../src/modules/cart.js';
import { buildSupportReply } from '../src/services/support.js';
import { SupportBot } from '../src/modules/support.js';

// Issue #10: o cupom vale a partir do valor mínimo, inclusive (RF03). Texto que diz
// "acima de R$ X" promete outra regra; só o frete grátis automático é "acima de R$ 800".

test('descrição de cada cupom diz "a partir de" o valor mínimo', () => {
  for (const [code, rule] of Object.entries(COUPON_RULES)) {
    assert.match(rule.description, new RegExp(` a partir de R\\$ ${rule.min}$`), code);
  }
});

test('cupom vale no mínimo exato; abaixo é recusado e a mensagem informa o mínimo', () => {
  assert.match(validateCouponCode('AGRO10', 149.99).message, /exige valor mínimo de R\$ 150\.00\./);

  assert.equal(new CartEngine([{ id: 'p1', price: 150, quantity: 1 }]).validateCoupon('AGRO10').valid, true);
  const below = new CartEngine([{ id: 'p1', price: 149.99, quantity: 1 }]).validateCoupon('AGRO10');
  assert.equal(below.valid, false);
  assert.match(below.message, /a partir de R\$ 150\.00\./);
});

test('chatbot cita o mínimo do cupom como limite inclusivo e mantém o frete automático acima de R$ 800,00', () => {
  const { FRETEGRATIS, COLHEITA20 } = COUPON_RULES;
  const frete = buildSupportReply('frete').text;
  assert.match(frete, /pedidos acima de R\$ 800,00/);
  assert.match(frete, new RegExp(`cupom FRETEGRATIS em compras a partir de R\\$ ${FRETEGRATIS.min},00`));
  assert.match(buildSupportReply('cupom').text, new RegExp(`COLHEITA20 \\(20% OFF a partir de R\\$ ${COLHEITA20.min}\\)`));
  assert.match(new SupportBot().reply('frete').text, new RegExp(`FRETEGRATIS \\(mínimo R\\$ ${FRETEGRATIS.min},00\\)`));
});
