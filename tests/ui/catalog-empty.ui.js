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

// Mensagem de vazio da grade: 'catalog' (sem anúncio publicado), 'search' (busca sem resultado) ou
// null. O botão de anunciar fica dentro dela, só para quem entrou.
const EMPTY_KIND = "document.querySelector('[data-empty]')?.dataset.empty ?? null";
const EMPTY_BUTTON = "document.querySelector('[data-empty] button')?.textContent.trim() ?? null";
const TEXT = "document.querySelector('#main-content').innerText";
const SUBMIT = "document.querySelector('#main-content form button[type=\"submit\"]').click()";

test('catálogo sem anúncio mostra mensagem própria, sem o aviso de busca e sem botão para quem não entrou', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: [] } });
  const text = await page.evaluate(TEXT);
  assert.match(text, /Nenhum anúncio publicado ainda/);
  assert.doesNotMatch(text, /Nenhum anúncio encontrado/);
  assert.equal(await page.evaluate(EMPTY_KIND), 'catalog');
  assert.equal(await page.evaluate(EMPTY_BUTTON), null);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('quem entrou vê no catálogo vazio o botão para anunciar, que abre a tela de anúncio', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: [] } });
  await page.evaluate("navigateTo('sell')"); // sem login, leva ao login
  await page.evaluate(`document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
    document.getElementById('loginPassword').value = 'demo123';
    ${SUBMIT}`);
  await page.waitFor("state.user && state.user.email === 'demo@agrotech.com.br'");
  await page.evaluate("navigateTo('catalog')");
  assert.equal(await page.evaluate(EMPTY_BUTTON), '+ Anunciar Meu Lote');
  await page.evaluate("document.querySelector('[data-empty] button').click()");
  assert.equal(await page.evaluate('state.activeScreen'), 'sell');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('busca sem resultado mostra a mensagem de busca, e apagar o termo volta os cartões', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: CATALOG } });
  await type(page, 'xyz');
  assert.equal(await page.evaluate(EMPTY_KIND), 'search');
  const text = await page.evaluate(TEXT);
  assert.match(text, /Nenhum anúncio encontrado/);
  assert.doesNotMatch(text, /Nenhum anúncio publicado ainda/);
  assert.equal(await page.evaluate(SHOWN), 0);
  assert.equal(await page.evaluate(EMPTY_BUTTON), null);

  await type(page, '');
  assert.equal(await page.evaluate(EMPTY_KIND), null);
  assert.equal(await page.evaluate(SHOWN), 3);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('falha da API não diz que o catálogo está vazio: mostra o erro', { skip: skipReason }, async () => {
  const page = await app.open({ products: { status: 500, body: { message: 'Banco de dados indisponível' } } });
  const text = await page.evaluate(TEXT);
  assert.match(text, /Banco de dados indisponível/);
  assert.doesNotMatch(text, /Nenhum anúncio publicado ainda|Nenhum anúncio encontrado/);
  assert.equal(await page.evaluate(EMPTY_KIND), null);
  await page.close();
});
