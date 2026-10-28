// Issue #20: no detalhe do produto, "Falar com o Produtor" chamava pelo onclick o showToast, que
// não estava em window: ReferenceError no clique e nenhum aviso. Roda no Chrome headless
// (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

test('"Falar com o Produtor" mostra o aviso de contato, sem erro na página', { skip: skipReason }, async () => {
  const page = await app.open();
  await page.evaluate(`document.querySelector('.product-card [onclick^="openProductDetail"]').click()`);
  await page.evaluate(`[...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Falar com o Produtor').click()`);
  assert.deepEqual(page.errors, [], 'o clique deu erro na página');
  await page.waitFor(`document.querySelector('#toast-root .toast.info')?.textContent.startsWith('Conectando ao WhatsApp do Produtor')`);
  await page.close();
});
