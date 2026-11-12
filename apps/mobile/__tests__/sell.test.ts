// Anúncio: preço em formato brasileiro e validação antes de enviar (o servidor valida de novo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceBR, validateProduct } from '../src/lib/sell.ts';

test('preço aceita vírgula decimal e ponto de milhar', () => {
  assert.equal(parsePriceBR('89,90'), 89.9);
  assert.equal(parsePriceBR('1.234,56'), 1234.56);
  assert.equal(parsePriceBR('R$ 1.234,56'), 1234.56);
  assert.equal(parsePriceBR('150'), 150);
  assert.equal(parsePriceBR('1.500'), 1500, 'ponto com 3 dígitos é milhar');
  assert.equal(parsePriceBR('89.9'), 89.9, 'ponto com 1 ou 2 dígitos é decimal');
  assert.ok(Number.isNaN(parsePriceBR('')));
  assert.ok(Number.isNaN(parsePriceBR('abc')));
  assert.ok(Number.isNaN(parsePriceBR('1,2,3')));
});

const ok = { name: 'Milho', price: '450,00', category: 'Grãos', description: 'Saco 20 kg', stock: '10' };

test('anúncio completo passa', () => {
  assert.equal(validateProduct(ok), null);
});

test('anúncio exige nome, preço válido, categoria e descrição', () => {
  assert.equal(validateProduct({ ...ok, name: ' ' }), 'Informe o nome do produto.');
  assert.equal(validateProduct({ ...ok, price: '0' }), 'Informe um preço maior que zero (até R$ 10.000.000).');
  assert.equal(validateProduct({ ...ok, price: 'abc' }), 'Informe um preço maior que zero (até R$ 10.000.000).');
  assert.equal(validateProduct({ ...ok, price: '10.000.001' }), 'Informe um preço maior que zero (até R$ 10.000.000).');
  assert.equal(validateProduct({ ...ok, category: '' }), 'Escolha a categoria.');
  assert.equal(validateProduct({ ...ok, description: '' }), 'Descreva o produto.');
});

test('estoque é inteiro de 0 a 1.000.000', () => {
  assert.equal(validateProduct({ ...ok, stock: '0' }), null);
  assert.equal(validateProduct({ ...ok, stock: '2,5' }), 'O estoque é um número inteiro de 0 a 1.000.000.');
  assert.equal(validateProduct({ ...ok, stock: '-1' }), 'O estoque é um número inteiro de 0 a 1.000.000.');
  assert.equal(validateProduct({ ...ok, stock: '1000001' }), 'O estoque é um número inteiro de 0 a 1.000.000.');
});
