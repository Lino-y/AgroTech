// Issue #19 (RF03): a tela do carrinho só anuncia frete grátis por compra acima de R$ 800,00
// quando o resumo (calculateCartSummary) diz que foi o valor da compra que zerou o frete.
// Roda no Chrome headless contra um banco descartável (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

// Só o lote de R$ 800 dá R$ 800,00 cravados; com o de R$ 0,01, R$ 800,01.
const products = [
  { id: 'p800', name: 'Lote de R$ 800', category: 'Sementes', price: 800, rating: 5, reviewsCount: 0 },
  { id: 'p001', name: 'Lote de R$ 0,01', category: 'Sementes', price: 0.01, rating: 5, reviewsCount: 0 }
];
const click = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
// O resumo como o usuário lê: valor das linhas e qual aviso de frete aparece.
const SUMMARY = `(() => {
  const value = (label) => [...document.querySelectorAll('#main-content span')].find((el) => el.textContent === label)?.nextElementSibling.textContent.trim();
  const text = document.getElementById('main-content').innerText;
  return {
    subtotal: value('Subtotal'),
    shipping: value('Frete Fazenda'),
    earned: text.includes('Você ganhou frete grátis por compra acima de R$ 800!'),
    hint: text.includes('Dica: Frete grátis automático em compras acima de R$ 800,00!')
  };
})()`;

test('carrinho de R$ 800,00 cobra o frete e mostra a dica; o frete grátis por compra só vem em R$ 800,01', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: products } });
  await click(page, `[onclick="addToCart('p800')"]`);
  // O carrinho exige login: entra com o usuário de exemplo do banco descartável e volta a ele.
  await click(page, `nav [onclick="navigateTo('cart')"]`);
  await page.evaluate(`(() => {
    document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
    document.getElementById('loginPassword').value = 'demo123';
    document.querySelector('#main-content form button[type="submit"]').click();
  })()`);
  await page.waitFor("state.activeScreen === 'cart'");
  assert.deepEqual(await page.evaluate(SUMMARY), { subtotal: 'R$ 800.00', shipping: 'R$ 35.00', earned: false, hint: true });

  // Em R$ 800,00 só o cupom FRETEGRATIS zera o frete, e isso não é compra acima de R$ 800.
  await click(page, `[onclick="copyCoupon('FRETEGRATIS')"]`);
  assert.deepEqual(await page.evaluate(SUMMARY), { subtotal: 'R$ 800.00', shipping: 'GRÁTIS', earned: false, hint: true });
  await click(page, '[onclick="removeAppliedCoupon()"]');

  await click(page, 'nav img[alt="AgroTech"]');
  await click(page, `[onclick="addToCart('p001')"]`);
  await click(page, `nav [onclick="navigateTo('cart')"]`);
  assert.deepEqual(await page.evaluate(SUMMARY), { subtotal: 'R$ 800.01', shipping: 'GRÁTIS', earned: true, hint: false });
  assert.deepEqual(page.errors, []);
  await page.close();
});
