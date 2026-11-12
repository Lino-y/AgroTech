// Regras do catálogo na tela: busca sem acento, categoria, preço em reais e contagem. Sem React Native.
import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriesOf, countLabel, filterProducts, formatDate, formatPrice } from '../src/lib/catalog.ts';

const products = [
  { id: '1', name: 'Semente de Milho Híbrido', category: 'Sementes', price: 120 },
  { id: '2', name: 'Adubo NPK 20-05-20', category: 'Fertilizantes', price: 89.9 },
  { id: '3', name: 'Trator Compacto', category: 'Máquinas', price: 150000 },
  { id: '4', name: 'Semente de Soja', category: 'Sementes', price: 75.5 }
];

test('busca ignora acento e maiúscula', () => {
  assert.deepEqual(filterProducts(products, 'MAQUINA', null).map((p) => p.id), ['3']);
  assert.deepEqual(filterProducts(products, 'híbrido', null).map((p) => p.id), ['1']);
});

test('busca também casa com a categoria', () => {
  assert.deepEqual(filterProducts(products, 'fertiliz', null).map((p) => p.id), ['2']);
});

test('categoria filtra; "Todos" e nulo não filtram', () => {
  assert.deepEqual(filterProducts(products, '', 'Sementes').map((p) => p.id), ['1', '4']);
  assert.equal(filterProducts(products, '', 'Todos').length, 4);
  assert.equal(filterProducts(products, '', null).length, 4);
});

test('busca e categoria combinam', () => {
  assert.deepEqual(filterProducts(products, 'soja', 'Sementes').map((p) => p.id), ['4']);
  assert.deepEqual(filterProducts(products, 'soja', 'Máquinas'), []);
});

test('categorias únicas, na ordem em que aparecem', () => {
  assert.deepEqual(categoriesOf(products), ['Sementes', 'Fertilizantes', 'Máquinas']);
});

test('preço em reais com vírgula e separador de milhar', () => {
  assert.equal(formatPrice(89.9), 'R$ 89,90');
  assert.equal(formatPrice(0), 'R$ 0,00');
  assert.equal(formatPrice(150000), 'R$ 150.000,00');
  assert.equal(formatPrice(1234.5), 'R$ 1.234,50');
});

test('contagem no singular e no plural', () => {
  assert.equal(countLabel(1), '1 item');
  assert.equal(countLabel(0), '0 itens');
  assert.equal(countLabel(4), '4 itens');
});

test('data do pedido em dd/mm/aaaa; inválida vira vazio', () => {
  assert.equal(formatDate('2026-03-05T12:00:00'), '05/03/2026');
  assert.equal(formatDate(undefined), '');
  assert.equal(formatDate('não é data'), '');
});
