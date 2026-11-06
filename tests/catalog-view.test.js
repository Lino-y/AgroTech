// Regra da lista do catálogo na tela (categoria + termo da busca), usada pela grade e pelo
// contador de src/services/catalog-view.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCatalogProducts } from '../src/services/catalog-view.js';

const products = [
  { name: 'Semente de Soja', category: 'Sementes' },
  { name: 'Trator Compacto', category: 'Máquinas' },
  { name: 'Adubo NPK', category: 'Insumos' },
  { name: 'Semente de Milho', category: 'Sementes' }
];
const names = (list) => list.map((product) => product.name);

test('sem termo e com categoria Todos, a lista tem todos os anúncios', () => {
  assert.equal(filterCatalogProducts(products, 'Todos', '').length, 4);
});

test('o termo casa o nome sem diferenciar maiúsculas, somado à categoria escolhida', () => {
  assert.deepEqual(names(filterCatalogProducts(products, 'Sementes', 'MILHO')), ['Semente de Milho']);
  assert.deepEqual(names(filterCatalogProducts(products, 'Todos', 'semente')), ['Semente de Soja', 'Semente de Milho']);
});

test('o termo também casa a categoria do anúncio', () => {
  assert.deepEqual(names(filterCatalogProducts(products, 'Todos', 'máquinas')), ['Trator Compacto']);
});

test('termo sem resultado devolve lista vazia', () => {
  assert.deepEqual(filterCatalogProducts(products, 'Todos', 'xyz'), []);
});

test('categoria que não existe mais mostra tudo, como a tela já fazia', () => {
  assert.equal(filterCatalogProducts(products, 'Ferramentas', '').length, 4);
});
