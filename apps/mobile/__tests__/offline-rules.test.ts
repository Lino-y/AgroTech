// Regras do offline controlado (Fase 3 da spec 08): catálogo salvo enxuto, de onde vem o catálogo
// sem rede, carrinho revalidado antes do pedido (RN05) e nada financeiro guardado (RN06).
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeChange, revalidateCart, serializeCart, type CartLine } from '../src/lib/cart.ts';
import { formatDateTime, offlineCatalog, slimProduct } from '../src/lib/catalog.ts';
import type { Product } from '../src/services/products.ts';

test('produto salvo leva só o que as telas usam: sem comentário, dono nem foto em base64', () => {
  const full = {
    id: '9',
    name: 'Milho',
    price: 450,
    category: 'Grãos',
    image: 'data:image/jpeg;base64,AAAA',
    imageEmoji: '🌽',
    comments: [{ text: 'ótimo' }],
    ownerEmail: 'vendedor@x.com',
    stock: 3
  } as unknown as Product;
  const slim = slimProduct(full);
  assert.equal(slim.image, undefined);
  assert.equal('comments' in slim, false);
  assert.equal('ownerEmail' in slim, false);
  assert.equal(slim.stock, 3);
  assert.equal(slimProduct({ ...full, image: 'https://img.test/milho.jpg' }).image, 'https://img.test/milho.jpg');
});

test('sem rede: usa o último catálogo consultado; sem ele, o de demonstração', () => {
  const snapshot = [{ id: 'demo', name: 'Demo', price: 1 }];
  const saved = { savedAt: '2026-11-12T10:00:00Z', data: [{ id: '1', name: 'Milho', price: 450 }] };
  assert.deepEqual(offlineCatalog(saved, snapshot), { items: saved.data, source: 'cache', savedAt: saved.savedAt });
  assert.deepEqual(offlineCatalog(null, snapshot), { items: snapshot, source: 'snapshot', savedAt: null });
  assert.deepEqual(offlineCatalog({ savedAt: 'x', data: [] }, snapshot).source, 'snapshot');
});

test('data e hora do cache em dd/mm/aaaa hh:mm', () => {
  assert.equal(formatDateTime('2026-03-05T09:07:00'), '05/03/2026 09:07');
  assert.equal(formatDateTime(null), '');
});

const milho = { id: '3', name: 'Milho', price: 450 };
const racao = { id: '1', name: 'Ração', price: 89.9 };

test('carrinho sem mudança no catálogo passa igual', () => {
  const lines: CartLine[] = [{ product: milho, quantity: 2 }];
  const result = revalidateCart(lines, [milho, racao]);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.lines, lines);
});

test('preço novo do catálogo entra no carrinho e é avisado', () => {
  const result = revalidateCart([{ product: milho, quantity: 2 }], [{ ...milho, price: 480 }]);
  assert.equal(result.lines[0].product.price, 480);
  assert.deepEqual(result.changes, [{ kind: 'price', name: 'Milho', from: 450, to: 480 }]);
});

test('produto que saiu do catálogo sai do carrinho e é avisado', () => {
  const result = revalidateCart([{ product: milho, quantity: 1 }, { product: racao, quantity: 1 }], [racao]);
  assert.deepEqual(result.lines.map((line) => line.product.id), ['1']);
  assert.deepEqual(result.changes, [{ kind: 'removed', name: 'Milho' }]);
});

test('estoque conhecido limita a quantidade; estoque zero tira do carrinho', () => {
  const limited = revalidateCart([{ product: milho, quantity: 5 }], [{ ...milho, stock: 3 }]);
  assert.equal(limited.lines[0].quantity, 3);
  assert.deepEqual(limited.changes, [{ kind: 'stock', name: 'Milho', from: 5, to: 3 }]);
  const empty = revalidateCart([{ product: milho, quantity: 1 }], [{ ...milho, stock: 0 }]);
  assert.deepEqual(empty.lines, []);
  assert.deepEqual(empty.changes, [{ kind: 'removed', name: 'Milho' }]);
});

test('carrinho salvo leva só produto e quantidade: nada de pagamento (RN06)', () => {
  const saved = serializeCart([{ product: { ...milho, comments: [] } as unknown as CartLine['product'], quantity: 2 }]);
  assert.deepEqual(Object.keys(saved[0]).sort(), ['product', 'quantity']);
  assert.equal('comments' in saved[0].product, false);
  const text = JSON.stringify(saved).toLowerCase();
  for (const forbidden of ['payment', 'pix', 'boleto', 'credit', 'card', 'cartao', 'cartão']) {
    assert.equal(text.includes(forbidden), false, `"${forbidden}" no carrinho salvo`);
  }
});

test('a mudança vira texto claro para a tela', () => {
  assert.equal(describeChange({ kind: 'price', name: 'Milho', from: 450, to: 480 }), 'Milho: preço de R$ 450,00 para R$ 480,00');
  assert.equal(describeChange({ kind: 'removed', name: 'Milho' }), 'Milho: saiu do catálogo e foi tirado do carrinho');
  assert.equal(describeChange({ kind: 'stock', name: 'Milho', from: 5, to: 3 }), 'Milho: quantidade ajustada de 5 para 3 (estoque)');
});
