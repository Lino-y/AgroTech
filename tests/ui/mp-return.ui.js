// Spec 10, parte 3c (passo 5): a volta do Mercado Pago na SPA. Roda no Chrome headless contra um servidor
// sem as variáveis MP_* (modo simulado): a volta não deve agir, e o pedido guardado para depois do login
// deve sobreviver a um recarregamento da página. Base em tests/ui/browser.js (`npm run test:ui`).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

const STORAGE_KEY = 'agrotech.pendingReturn';
const APP_CONFIG_LOADED = "performance.getEntriesByType('resource').some((entry) => entry.name.includes('/api/app-config'))";

test('no modo simulado a volta com ?pedido= não age: nada é consultado e a URL fica como veio', { skip: skipReason }, async () => {
  const page = await app.open();
  await page.evaluate("location.assign(location.origin + '/?pedido=AGT-B403E9D09B59')");
  await page.waitFor(`window.state && !state.loadingProducts && ${APP_CONFIG_LOADED}`);
  assert.equal(await page.evaluate('state.payments'), 'simulado');
  assert.equal(await page.evaluate('location.search'), '?pedido=AGT-B403E9D09B59', 'a URL não é limpa no simulado');
  assert.doesNotMatch(await page.evaluate("document.querySelector('#main-content').innerText"), /Pagamento aprovado/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('um pedido guardado para depois do login sobrevive a um recarregamento; valor inválido é descartado', { skip: skipReason }, async () => {
  const page = await app.open();
  await page.evaluate(`sessionStorage.setItem('${STORAGE_KEY}', 'AGT-B403E9D09B59')`);
  await page.evaluate('window.__antesDeRecarregar = true');
  await page.send('Page.reload');
  await page.waitFor('!window.__antesDeRecarregar && window.state && !state.loadingProducts');
  assert.equal(await page.evaluate('state.pendingReturn'), 'AGT-B403E9D09B59');

  await page.evaluate(`sessionStorage.setItem('${STORAGE_KEY}', '<img src=x>')`);
  await page.evaluate('window.__antesDeRecarregar = true');
  await page.send('Page.reload');
  await page.waitFor('!window.__antesDeRecarregar && window.state && !state.loadingProducts');
  assert.equal(await page.evaluate('state.pendingReturn'), null, 'valor fora do formato do servidor não entra no estado');
  await page.close();
});
