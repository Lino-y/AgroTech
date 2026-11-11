// Issue #40: o pedido manda só o que o servidor usa (items e coupon), e as moedas saem do total que
// o servidor cobrou (newOrder.total), não do total calculado na tela. Roda no Chrome headless contra
// um banco descartável (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCartSummary } from '../../packages/domain/commerce.js';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

// Preço de catálogo que a aba tem em memória (R$ 100) é diferente do que o servidor tem (R$ 89,90,
// seed de server.js): o total da tela fica R$ 215,00, e o servidor cobra R$ 196,82.
const staleProducts = [
  { id: '1', name: 'Ração Bovinos Corte 30kg', category: 'Rações', price: 100, rating: 4.8, reviewsCount: 32 }
];
const SERVER_PRICE = 89.9;

const click = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);

test('pagamento manda só items e coupon, e as moedas usam o total cobrado pelo servidor', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: staleProducts } });
  await click(page, `[onclick="addToCart('1')"]`);
  await click(page, `[onclick="addToCart('1')"]`);
  await click(page, `nav [onclick="navigateTo('cart')"]`);
  await page.evaluate(`(() => {
    document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
    document.getElementById('loginPassword').value = 'demo123';
    document.querySelector('#main-content form button[type="submit"]').click();
  })()`);
  await page.waitFor("state.activeScreen === 'cart'");
  await click(page, `[onclick="copyCoupon('AGRO10')"]`);
  await click(page, `[onclick="navigateTo('payment')"]`);
  await page.waitFor("state.activeScreen === 'payment'");

  // Guarda o corpo enviado e a resposta do POST /api/orders, sem mudar o comportamento da página.
  await page.evaluate(`(() => {
    const fetchOriginal = window.fetch;
    window.__sent = null;
    window.__order = null;
    window.fetch = async (url, options) => {
      const response = await fetchOriginal(url, options);
      if (String(url) === '/api/orders' && options?.method === 'POST') {
        window.__sent = options.body;
        window.__order = await response.clone().json();
      }
      return response;
    };
    window.__coinsBefore = state.coins;
  })()`);
  await page.evaluate("document.querySelector('#main-content form button[type=\"submit\"]').click()");
  await page.waitFor("state.activeScreen === 'orders' && window.__order");

  const sent = JSON.parse(await page.evaluate('window.__sent'));
  const order = await page.evaluate('window.__order');
  const coinsEarned = await page.evaluate('state.coins - window.__coinsBefore');
  assert.deepEqual(sent, { items: [{ id: '1', quantity: 2 }], coupon: 'AGRO10' });
  // O servidor cobra pelo catálogo dele: 2 x R$ 89,90 com AGRO10 e frete.
  assert.equal(order.total, calculateCartSummary([{ price: SERVER_PRICE, quantity: 2 }], 'AGRO10').total);
  assert.equal(coinsEarned, Math.round(order.total / 10));
  assert.deepEqual(page.errors, []);
  await page.close();
});
