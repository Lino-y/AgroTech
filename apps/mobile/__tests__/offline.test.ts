// Catálogo embutido (modo offline): só campos do cartão, data legível e quando cair nele.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE_CATALOG_DATE, OFFLINE_PRODUCTS } from '../src/data/offline-catalog.ts';
import { shouldUseSnapshot, snapshotLabel } from '../src/lib/catalog.ts';

// Campos que o cartão usa. Qualquer outro (ownerEmail, comments, senha...) não pode ir para o APK.
const ALLOWED = new Set(['id', 'name', 'price', 'category', 'imageEmoji', 'imageBg', 'rating']);

test('o catálogo embutido tem produtos válidos e ids únicos', () => {
  assert.ok(OFFLINE_PRODUCTS.length > 0);
  assert.equal(new Set(OFFLINE_PRODUCTS.map((p) => p.id)).size, OFFLINE_PRODUCTS.length);
  for (const product of OFFLINE_PRODUCTS) {
    assert.ok(product.name.trim().length > 0);
    assert.ok(Number.isFinite(product.price) && product.price > 0, `preço inválido em ${product.id}`);
  }
});

test('o catálogo embutido não carrega campos além dos do cartão', () => {
  for (const product of OFFLINE_PRODUCTS) {
    const extras = Object.keys(product).filter((key) => !ALLOWED.has(key));
    assert.deepEqual(extras, [], `campos extras em ${product.id}`);
  }
});

test('a data do catálogo embutido vira dd/mm/aaaa', () => {
  assert.match(OFFLINE_CATALOG_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(snapshotLabel('2026-11-11'), '11/11/2026');
});

test('só cai no catálogo embutido por falha de rede e com a lista vazia', () => {
  assert.equal(shouldUseSnapshot(0, 0), true);
  assert.equal(shouldUseSnapshot(0, 3), false, 'já há produtos na tela: não troca por dado velho');
  assert.equal(shouldUseSnapshot(500, 0), false, 'erro do servidor não é falta de rede');
  assert.equal(shouldUseSnapshot(401, 0), false);
  assert.equal(shouldUseSnapshot(403, 0), false);
  assert.equal(shouldUseSnapshot(404, 0), false);
});
