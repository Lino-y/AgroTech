// Issues #23 e #30: a busca filtra os cartões e o contador do catálogo juntos, e a tela diz
// "catálogo vazio" e "busca sem resultado" com mensagens diferentes. Roda no Chrome headless
// contra um banco descartável (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

// Lista controlada pelo teste (GET /api/products interceptado), para o resultado da busca ser exato.
const CATALOG = [
  { id: '1', name: 'Trator Compacto', category: 'Máquinas', price: 100, rating: 5, reviewsCount: 0 },
  { id: '2', name: 'Adubo NPK', category: 'Insumos', price: 50, rating: 5, reviewsCount: 0 },
  { id: '3', name: 'Semente de Milho', category: 'Sementes', price: 20, rating: 5, reviewsCount: 0 }
];
const COUNTER = "[...document.querySelectorAll('#main-content span')].map((el) => el.textContent.trim()).find((text) => /anúncios ativos$/.test(text))";
// Cartões que a tela mostra (cartão escondido por display: none não conta).
const SHOWN = "[...document.querySelectorAll('.product-card')].filter((el) => el.style.display !== 'none').length";
// Digita na busca como o usuário: muda o valor e dispara o evento que chama applySearchFilter.
const type = (page, term) => page.evaluate(`(() => {
  const input = document.getElementById('searchInput');
  input.value = ${JSON.stringify(term)};
  input.dispatchEvent(new Event('input'));
})()`);

test('busca: o contador e os cartões mostram só os anúncios que casam com o termo', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: CATALOG } });
  assert.equal(await page.evaluate(COUNTER), '3 anúncios ativos');
  await type(page, 'milho');
  assert.equal(await page.evaluate(COUNTER), '1 anúncios ativos');
  assert.equal(await page.evaluate(SHOWN), 1);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('busca: o contador continua certo depois de a tela ser redesenhada', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: CATALOG } });
  await type(page, 'milho');
  await page.evaluate("navigateTo('catalog')");
  assert.equal(await page.evaluate(COUNTER), '1 anúncios ativos');
  assert.equal(await page.evaluate(SHOWN), 1);
  assert.deepEqual(page.errors, []);
  await page.close();
});
