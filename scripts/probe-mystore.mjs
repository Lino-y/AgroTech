// Sonda manual: mede o card verde, o main-content e o app-container (node scripts/probe-mystore.mjs)
import { startApp } from '../tests/ui/browser.js';

const app = await startApp();
const page = await app.open();
await page.evaluate("navigateTo('cart')");
await page.evaluate(`(() => {
  document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
  document.getElementById('loginPassword').value = 'demo123';
  document.querySelector('#main-content form button[type="submit"]').click();
})()`);
await page.waitFor("state.user && state.user.email === 'demo@agrotech.com.br'", 8000);
await page.evaluate("navigateTo('mystore')");
const info = await page.evaluate(`(() => {
  const card = [...document.querySelectorAll('#main-content *')].find((el) => getComputedStyle(el).backgroundColor === 'rgb(27, 94, 32)');
  const wrapper = card.parentElement; // o div com padding e overflow-y:auto da tela
  const wr = wrapper.getBoundingClientRect();
  const before = wrapper.scrollTop;
  wrapper.scrollTop = wrapper.scrollHeight; // rola até o fim
  const cr = card.getBoundingClientRect();
  const covered = [...document.elementsFromPoint(cr.left + cr.width / 2, Math.min(cr.bottom - 2, innerHeight - 2))]
    .slice(0, 4)
    .map((el) => ({ tag: el.tagName, id: el.id, title: el.title, text: el.textContent.trim().slice(0, 14) }));
  wrapper.scrollTop = before;
  return { scrolledTo: wrapper.scrollTop, maxScroll: wrapper.scrollHeight, cardBottomAtEnd: Math.round(cr.bottom), winH: innerHeight, covered };
})()`);
console.log(JSON.stringify(info, null, 2));
await app.close();
