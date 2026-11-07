// Issue #42: o botão "+" (renderSellFab, fixo sobre a tela) cobria parte de "Ir para o Pagamento"
// no carrinho. Mede os retângulos em 360, 390 e 430 px e exige o botão inteiro e clicável; no
// catálogo o "+" continua. Roda no Chrome headless (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

const WIDTHS = [360, 390, 430];
const products = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, name: `Lote ${n}`, category: 'Sementes', price: 50, rating: 5, reviewsCount: 0 }));
const click = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);

// Rola o carrinho até o fim (onde o botão encosta no "+") e mede o botão e o "+". Pontos nas
// bordas retas e no meio do botão (sem os cantos arredondados) que não caem em "Ir para o Pagamento"
// (elementFromPoint) contam como bloqueados.
const LAYOUT = `(() => {
  const pay = [...document.querySelectorAll('#main-content button')].find((el) => el.textContent.includes('Ir para o Pagamento'));
  const scroller = pay.closest('div[style*="overflow-y: auto"]');
  scroller.scrollTop = scroller.scrollHeight;
  const box = pay.getBoundingClientRect();
  const fab = document.querySelector('#main-content button[title="Anunciar produto"]')?.getBoundingClientRect() ?? null;
  const midX = (box.left + box.right) / 2;
  const midY = (box.top + box.bottom) / 2;
  const points = [[box.left + 1, midY], [midX, box.top + 1], [midX, midY], [midX, box.bottom - 1], [box.right - 1, midY]];
  const blocked = points.filter(([x, y]) => !pay.contains(document.elementFromPoint(x, y))).length;
  const overlap = fab !== null && box.left < fab.right && fab.left < box.right && box.top < fab.bottom && fab.top < box.bottom;
  const round = (r) => [r.left, r.top, r.right, r.bottom].map(Math.round);
  return { viewport: window.innerWidth, pay: round(box), fab: fab && round(fab), overlap, blocked };
})()`;

test('carrinho: "Ir para o Pagamento" fica inteiro e clicável em 360, 390 e 430 px', { skip: skipReason }, async () => {
  for (const width of WIDTHS) {
    const page = await app.open({ products: { body: products }, width });
    try {
      for (const { id } of products) await click(page, `[onclick="addToCart('${id}')"]`);
      await click(page, `nav [onclick="navigateTo('cart')"]`);
      // O carrinho exige login: entra com o usuário de exemplo do banco descartável.
      await page.evaluate(`(() => {
        document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
        document.getElementById('loginPassword').value = 'demo123';
        document.querySelector('#main-content form button[type="submit"]').click();
      })()`);
      await page.waitFor("state.activeScreen === 'cart'");
      // O aviso de "adicionado ao carrinho" fica 2,6 s no rodapé e cobriria o botão: espera ele sair.
      await page.waitFor("!document.querySelector('#toast-root .toast')");
      const layout = await page.evaluate(LAYOUT);
      assert.deepEqual({ width, overlap: layout.overlap, blocked: layout.blocked }, { width, overlap: false, blocked: 0 }, JSON.stringify(layout));
      assert.deepEqual(page.errors, []);
    } finally {
      await page.close();
    }
  }
});

test('o "+" continua visível no catálogo', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: products } });
  try {
    assert.equal(await page.evaluate(`!!document.querySelector('#main-content button[title="Anunciar produto"]')`), true);
  } finally {
    await page.close();
  }
});
