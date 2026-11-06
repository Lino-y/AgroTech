// Issue #28 (foco do teclado visível em todo botão) e #29 (redesenhar a tela mantém o foco e a
// rolagem dos carrosséis). Roda no Chrome headless (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

// Dez categorias: os chips passam da largura do app e o carrossel tem o que rolar.
const CATEGORIES = ['Sementes', 'Fertilizantes', 'Defensivos', 'Rações', 'Máquinas', 'Irrigação', 'Ferramentas', 'Veterinária', 'Mudas', 'Grãos'];
const products = CATEGORIES.map((category, i) => ({ id: `p${i}`, name: `Lote ${i}`, category, price: 100, rating: 5, reviewsCount: 0 }));
const CAROUSEL = "document.querySelector('.drag-scroll-container')";
const openCatalog = () => app.open({ width: 1280, height: 800, products: { body: products } });
const scrollLeft = (page) => page.evaluate(`${CAROUSEL}.scrollLeft`);

// Foco atual: se o navegador mostra o foco de teclado e se há contorno aplicado.
const FOCUS = `(() => {
  const el = document.activeElement;
  const style = getComputedStyle(el);
  return {
    name: el.textContent.trim(),
    focusVisible: el.matches(':focus-visible'),
    ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
  };
})()`;

const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }
};
async function press(page, name) {
  await page.send('Input.dispatchKeyEvent', { type: KEYS[name].text ? 'keyDown' : 'rawKeyDown', ...KEYS[name] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...KEYS[name] });
}

// Tab a partir da busca, como o usuário faria, até a condição valer (no máximo 30 toques).
async function tabUntil(page, condition, what) {
  await page.evaluate("document.getElementById('searchInput').focus()");
  for (let i = 0; i < 30; i++) {
    await press(page, 'Tab');
    if (await page.evaluate(condition)) return;
  }
  assert.fail(`o Tab não chegou a ${what}`);
}
const tabTo = (page, name) => tabUntil(page, `document.activeElement.textContent.trim() === ${JSON.stringify(name)}`, `o chip ${name}`);

test('pelo teclado, o botão fora do carrossel mostra o foco com contorno', { skip: skipReason }, async () => {
  const page = await openCatalog();
  // Depois dos chips vem o primeiro botão de produto, fora do carrossel.
  await tabUntil(page, "document.activeElement.tagName === 'BUTTON' && !document.activeElement.closest('.drag-scroll-container')", 'um botão fora do carrossel');
  const focus = await page.evaluate(FOCUS);
  assert.equal(focus.focusVisible, true);
  assert.equal(focus.ring, true, `sem contorno no foco do teclado em "${focus.name}"`);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('clique do mouse num botão fora do carrossel não mostra contorno', { skip: skipReason }, async () => {
  const page = await openCatalog();
  // Guarda o contorno no instante em que o botão ganha foco, antes de o clique redesenhar a tela.
  await page.evaluate("document.addEventListener('focusin', (e) => { window.__ringNoClique = getComputedStyle(e.target).outlineStyle; }, { once: true })");
  const at = await page.evaluate(`(() => {
    const button = document.querySelector('.product-card button');
    button.scrollIntoView({ block: 'center' });
    const box = button.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', buttons: 1, clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', buttons: 0, clickCount: 1 });
  await page.waitFor('state.cart.length > 0');
  assert.equal(await page.evaluate('window.__ringNoClique'), 'none');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('Enter num chip do carrossel devolve o foco ao mesmo chip depois de redesenhar a tela', { skip: skipReason }, async () => {
  const page = await openCatalog();
  await tabTo(page, 'Fertilizantes');
  await press(page, 'Enter');
  await page.waitFor("state.selectedCategory === 'Fertilizantes'");
  assert.deepEqual(await page.evaluate(FOCUS), { name: 'Fertilizantes', focusVisible: true, ring: true });
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('redesenhar a tela mantém a rolagem horizontal do carrossel', { skip: skipReason }, async () => {
  const page = await openCatalog();
  // Tab até o último chip rola o carrossel até ele.
  await tabTo(page, 'Grãos');
  const before = await scrollLeft(page);
  assert.ok(before > 0, 'o carrossel não rolou com o foco');

  await press(page, 'Enter');
  await page.waitFor("state.selectedCategory === 'Grãos'");
  // 1px de folga: scrollLeft pode ser fracionário e o navegador arredonda ao devolver.
  assert.ok(Math.abs((await scrollLeft(page)) - before) <= 1, 'o redesenho zerou a rolagem do carrossel');
  assert.deepEqual(page.errors, []);
  await page.close();
});
