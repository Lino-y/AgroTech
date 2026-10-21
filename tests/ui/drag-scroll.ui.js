// Issue #9 (RNF03): drag-to-scroll dos carrosséis no desktop (enableDragToScroll em
// src/modules/catalog.js), sem clique indevido e sem atrapalhar teclado e toque. Roda no Chrome
// headless (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

// Dez categorias: os chips passam da largura do app (430px) e o carrossel tem o que rolar.
const CATEGORIES = ['Sementes', 'Fertilizantes', 'Defensivos', 'Rações', 'Máquinas', 'Irrigação', 'Ferramentas', 'Veterinária', 'Mudas', 'Grãos'];
const products = CATEGORIES.map((category, i) => ({ id: `p${i}`, name: `Lote ${i}`, category, price: 100, rating: 5, reviewsCount: 0 }));
const CAROUSEL = "document.querySelector('.drag-scroll-container')";
const chip = (name) => `[...${CAROUSEL}.children].find((el) => el.textContent.trim() === ${JSON.stringify(name)})`;

// Viewport de desktop, onde o RNF03 pede o arraste com o mouse.
const openCatalog = () => app.open({ width: 1280, height: 800, products: { body: products } });
const scrollLeft = (page) => page.evaluate(`${CAROUSEL}.scrollLeft`);
const selected = (page) => page.evaluate('state.selectedCategory');
const center = (page, element) => page.evaluate(`(() => {
  const box = ${element}.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
})()`);

// Aperta, move dx pixels em 10 passos e solta; dx 0 é um clique parado.
async function drag(page, { x, y }, dx) {
  const mouse = (type, px, extra) => page.send('Input.dispatchMouseEvent', { type, x: px, y, button: 'left', ...extra });
  await mouse('mousePressed', x, { buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 10; step++) await mouse('mouseMoved', x + (dx * step) / 10, { buttons: 1 });
  await mouse('mouseReleased', x + dx, { buttons: 0, clickCount: 1 });
}

// O mesmo gesto com o dedo; dx 0 é um toque.
async function swipe(page, { x, y }, dx) {
  const touch = (type, points) => page.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x, y }]);
  for (let step = 1; step <= 10; step++) await touch('touchMove', [{ x: x + (dx * step) / 10, y }]);
  await touch('touchEnd', []);
}

const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }
};
async function press(page, name) {
  await page.send('Input.dispatchKeyEvent', { type: KEYS[name].text ? 'keyDown' : 'rawKeyDown', ...KEYS[name] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...KEYS[name] });
}

test('arrastar com o mouse rola o carrossel na direção do gesto, em viewport de desktop', { skip: skipReason }, async () => {
  const page = await openCatalog();
  assert.equal(await page.evaluate('innerWidth'), 1280);
  assert.ok(await page.evaluate(`${CAROUSEL}.scrollWidth - ${CAROUSEL}.clientWidth > 200`), 'o carrossel não tem o que rolar');

  await drag(page, await center(page, CAROUSEL), -120);
  const left = await scrollLeft(page);
  assert.ok(left >= 120, `arrastar para a esquerda tem que rolar para a direita (scrollLeft ${left})`);

  await drag(page, await center(page, CAROUSEL), 60);
  assert.ok(await scrollLeft(page) < left, 'arrastar para a direita tem que voltar');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('arrastar não aciona o chip em que o gesto começa e termina; o clique parado aciona', { skip: skipReason }, async () => {
  const page = await openCatalog();
  const start = await center(page, chip('Fertilizantes'));
  await drag(page, start, -40);
  assert.equal(await selected(page), 'Todos', 'o arraste virou clique no chip');
  assert.ok(await scrollLeft(page) > 0, 'o arraste não rolou');
  // Prova de que o gesto terminou em cima do mesmo chip, onde o navegador dispara o click.
  const under = await page.evaluate(`document.elementFromPoint(${start.x - 40}, ${start.y}).closest('button').textContent.trim()`);
  assert.equal(under, 'Fertilizantes');

  await drag(page, await center(page, chip('Fertilizantes')), 0);
  assert.equal(await selected(page), 'Fertilizantes', 'o clique parado não acionou o chip');
  await page.close();
});

// Chip com foco: nome, se aparece inteiro dentro do carrossel e se tem contorno de foco visível.
const FOCUSED = `(() => {
  const chip = document.activeElement;
  const box = chip.getBoundingClientRect();
  const view = ${CAROUSEL}.getBoundingClientRect();
  const style = getComputedStyle(chip);
  return {
    name: chip.textContent.trim(),
    inView: box.left >= view.left - 1 && box.right <= view.right + 1,
    ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
  };
})()`;

test('pelo teclado, Tab percorre os chips, cada um inteiro na vista e com foco visível, e Enter aciona', { skip: skipReason }, async () => {
  const page = await openCatalog();
  await page.evaluate("document.getElementById('searchInput').focus()");
  for (const name of ['Todos', ...CATEGORIES]) {
    await press(page, 'Tab');
    assert.deepEqual(await page.evaluate(FOCUSED), { name, inView: true, ring: true });
  }
  assert.ok(await scrollLeft(page) > 0, 'o foco não rolou o carrossel');

  await press(page, 'Enter');
  assert.equal(await selected(page), 'Grãos');
  await page.close();
});

test('no toque, tocar aciona o chip e deslizar rola o carrossel sem acionar outro', { skip: skipReason }, async () => {
  const page = await openCatalog();
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await swipe(page, await center(page, chip('Fertilizantes')), 0);
  await page.waitFor("state.selectedCategory === 'Fertilizantes'");

  await swipe(page, await center(page, CAROUSEL), -150);
  await page.waitFor(`${CAROUSEL}.scrollLeft > 0`);
  assert.equal(await selected(page), 'Fertilizantes', 'deslizar acionou um chip');
  await page.close();
});
