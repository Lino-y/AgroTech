// Carrinho do app: juntar linhas, limite de quantidade, itens do pedido e resumo pela regra compartilhada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addToCart,
  cartCount,
  cartSummary,
  MAX_ORDER_QUANTITY,
  removeFromCart,
  setQuantity,
  toOrderItems,
  type CartLine
} from '../src/lib/cart.ts';

const milho = { id: '3', name: 'Semente de Milho', price: 450 };
const racao = { id: '1', name: 'Ração', price: 89.9 };

test('adicionar o mesmo produto soma na linha que já existe', () => {
  let lines: CartLine[] = [];
  lines = addToCart(lines, milho, 1);
  lines = addToCart(lines, milho, 2);
  lines = addToCart(lines, racao, 1);
  assert.deepEqual(lines.map((l) => [l.product.id, l.quantity]), [['3', 3], ['1', 1]]);
  assert.equal(cartCount(lines), 4);
});

test('quantidade fica entre 1 e o limite do servidor; zero remove a linha', () => {
  let lines = addToCart([], milho, MAX_ORDER_QUANTITY + 50);
  assert.equal(lines[0].quantity, MAX_ORDER_QUANTITY);
  lines = setQuantity(lines, '3', 7);
  assert.equal(lines[0].quantity, 7);
  lines = setQuantity(lines, '3', 0);
  assert.deepEqual(lines, []);
});

test('remover tira só a linha do produto', () => {
  const lines = removeFromCart(addToCart(addToCart([], milho, 1), racao, 2), '3');
  assert.deepEqual(lines.map((l) => l.product.id), ['1']);
});

test('o pedido leva só id e quantidade: preço e total saem do servidor', () => {
  const lines = addToCart(addToCart([], milho, 2), racao, 1);
  assert.deepEqual(toOrderItems(lines), [{ id: '3', quantity: 2 }, { id: '1', quantity: 1 }]);
});

test('o resumo usa a regra compartilhada (frete grátis acima de R$ 800, cupom)', () => {
  const lines = addToCart([], milho, 2); // 900
  const semCupom = cartSummary(lines, null);
  assert.equal(semCupom.subtotal, 900);
  assert.equal(semCupom.shipping, 0);
  assert.equal(semCupom.total, 900);
  const comCupom = cartSummary(lines, 'COLHEITA20');
  assert.equal(comCupom.discount, 180);
  assert.equal(comCupom.total, 720);
  const pequeno = cartSummary(addToCart([], racao, 1), null);
  assert.equal(pequeno.shipping, 35);
});
