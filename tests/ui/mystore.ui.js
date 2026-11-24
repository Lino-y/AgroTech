// Tela "Minha Loja": o cabeçalho com capa, avatar e fundo verde não pode sair cortado da tela.
// Roda no Chrome headless contra um banco descartável (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());



async function loginAndOpenStore(page) {
  await page.evaluate("navigateTo('mystore')"); // exige login: leva ao login
  await page.evaluate(`(() => {
    document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
    document.getElementById('loginPassword').value = 'demo123';
    document.querySelector('#main-content form button[type="submit"]').click();
  })()`);
  await page.waitFor("state.activeScreen === 'mystore'");
}

// Card verde do cabeçalho: inteiro dentro da área visível da tela (sem corte pelo container).
const CARD_INTACT = `(() => {
  const card = [...document.querySelectorAll('#main-content > div > div')].find((el) => getComputedStyle(el).backgroundColor === 'rgb(27, 94, 32)');
  if (!card) return null;
  const screen = document.getElementById('main-content').getBoundingClientRect();
  const box = card.getBoundingClientRect();
  return {
    found: true,
    insideScreen: box.top >= screen.top - 1 && box.bottom <= screen.bottom + 1,
    bottom: Math.round(box.bottom),
    screenBottom: Math.round(screen.bottom)
  };
})()`;

test('cabeçalho da Minha Loja (capa + avatar) aparece inteiro, sem corte', { skip: skipReason }, async () => {
  const page = await app.open();
  await loginAndOpenStore(page);
  const check = await page.evaluate(CARD_INTACT);
  assert.ok(check, 'card verde do cabeçalho da loja não foi encontrado');
  assert.ok(check.insideScreen, `card cortado: bottom ${check.bottom} > tela ${check.screenBottom}`);
  assert.deepEqual(page.errors, []);
  await page.close();
});
