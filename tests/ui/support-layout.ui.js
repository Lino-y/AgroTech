// Issue #60: o botão "+" (renderSellFab, fixo sobre a tela) cobria o botão "Enviar" do chat de
// Suporte. Mede os retângulos em 360, 390 e 430 px e exige o "Enviar" inteiro e clicável. Mesma
// medição de cart-layout.ui.js (#42); o "+" no catálogo é conferido lá. Roda no Chrome headless
// (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

const WIDTHS = [360, 390, 430];

// Pontos nas bordas retas e no meio do botão (sem os cantos arredondados) que não caem em "Enviar"
// (elementFromPoint) contam como bloqueados.
const LAYOUT = `(() => {
  const send = [...document.querySelectorAll('#main-content button')].find((el) => el.textContent.trim() === 'Enviar');
  const box = send.getBoundingClientRect();
  const fab = document.querySelector('#main-content button[title="Anunciar produto"]')?.getBoundingClientRect() ?? null;
  const midX = (box.left + box.right) / 2;
  const midY = (box.top + box.bottom) / 2;
  const points = [[box.left + 1, midY], [midX, box.top + 1], [midX, midY], [midX, box.bottom - 1], [box.right - 1, midY]];
  const blocked = points.filter(([x, y]) => !send.contains(document.elementFromPoint(x, y))).length;
  const overlap = fab !== null && box.left < fab.right && fab.left < box.right && box.top < fab.bottom && fab.top < box.bottom;
  const round = (r) => [r.left, r.top, r.right, r.bottom].map(Math.round);
  return { viewport: window.innerWidth, send: round(box), fab: fab && round(fab), overlap, blocked };
})()`;

test('suporte: "Enviar" fica inteiro e clicável em 360, 390 e 430 px', { skip: skipReason }, async () => {
  for (const width of WIDTHS) {
    const page = await app.open({ width });
    try {
      await page.evaluate(`document.querySelector('#main-content [onclick="navigateTo(\\'support\\')"]').click()`);
      await page.waitFor("state.activeScreen === 'support'");
      const layout = await page.evaluate(LAYOUT);
      assert.deepEqual({ width, overlap: layout.overlap, blocked: layout.blocked }, { width, overlap: false, blocked: 0 }, JSON.stringify(layout));
      assert.deepEqual(page.errors, []);
    } finally {
      await page.close();
    }
  }
});
