// Issue #8 (RNF02): a SPA troca de tela sem recarregar, manda quem não entrou para o login nas
// telas protegidas e mostra os estados vazio e erro do catálogo. Roda no Chrome headless contra
// um banco descartável (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

const HEADING = "document.querySelector('#main-content h2, #main-content h3')?.textContent.trim()";
const CARDS = "document.querySelectorAll('.product-card').length";
const TEXT = 'document.body.innerText';
// Clica como o usuário: no botão pelo texto visível, ou no ícone (sem texto) pelo seletor.
const clickText = (page, text) => page.evaluate(`[...document.querySelectorAll('button')].find((el) => el.textContent.trim() === ${JSON.stringify(text)}).click()`);
const clickOn = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
// Entra pelo ícone do carrinho com o usuário de exemplo do banco descartável (João Silva).
async function loginFromCart(page) {
  await clickOn(page, `nav [onclick="navigateTo('cart')"]`);
  await page.evaluate(`(() => {
    document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
    document.getElementById('loginPassword').value = 'demo123';
    document.querySelector('#main-content form button[type="submit"]').click();
  })()`);
  await page.waitFor(`state.activeScreen === 'cart' && ${HEADING} === 'Carrinho de Compras'`);
}

test('navegação principal troca de tela sem recarregar a página', { skip: skipReason }, async () => {
  const page = await app.open();
  // Marca no window: se a página recarregar, o window é outro e a marca some.
  await page.evaluate('window.__mesmaPagina = true');
  // Entra antes: o Financeiro passa a exigir login com a #6, e logado o teste vale com ou sem ela.
  await loginFromCart(page);
  const steps = [
    [() => clickText(page, 'Financeiro'), 'Gestão Financeira'],
    [() => clickText(page, 'Suporte'), 'Suporte 24h'],
    [() => clickText(page, 'Catálogo'), 'Catálogo de Insumos'],
    [() => clickOn(page, `nav [onclick="navigateTo('profile')"]`), 'Olá, João'],
    [() => clickOn(page, 'nav img[alt="AgroTech"]'), 'Catálogo de Insumos']
  ];
  for (const [go, heading] of steps) {
    await go();
    assert.deepEqual(page.navigations, [], `ir para "${heading}" pediu navegação (reload)`);
    await page.waitFor(`${HEADING} === ${JSON.stringify(heading)}`);
  }
  assert.equal(await page.evaluate('window.__mesmaPagina'), true, 'a troca de tela recarregou a página');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('sem login, carrinho, pagamento e anúncio levam ao login; ao entrar, abre a tela pedida', { skip: skipReason }, async () => {
  const page = await app.open();
  for (const screen of ['cart', 'payment', 'sell']) {
    await page.evaluate(`navigateTo('${screen}')`);
    assert.deepEqual(await page.evaluate('[state.activeScreen, state.authMode, state.pendingScreen]'), ['register', 'login', screen]);
    assert.equal(await page.evaluate(HEADING), 'Bem-vindo de volta', `${screen} abriu sem login`);
    await clickText(page, 'Continuar sem login');
    assert.equal(await page.evaluate('state.activeScreen'), 'catalog');
  }
  // Pelo ícone do carrinho, entrando com o usuário de exemplo: abre a tela pedida, sem navegação.
  await loginFromCart(page);
  assert.deepEqual(page.navigations, [], 'o login pediu navegação (envio do form ou reload)');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('catálogo que fica vazio na API esvazia a tela: nenhum anúncio, sem erro e sem "carregando"', { skip: skipReason }, async () => {
  const page = await app.open();
  assert.ok(await page.evaluate(CARDS) > 0, 'o banco descartável deveria ter anúncios');
  page.products = { body: [] };
  await page.evaluate('retryLoadProducts()');
  await page.waitFor('!state.loadingProducts');
  assert.equal(await page.evaluate(CARDS), 0);
  const text = await page.evaluate(TEXT);
  assert.match(text, /0 anúncios ativos/);
  assert.doesNotMatch(text, /Carregando catálogo|Tentar Novamente/);
  await page.close();
});

test('falha da API mostra o erro com "Tentar Novamente", e a nova tentativa recupera o catálogo', { skip: skipReason }, async () => {
  const page = await app.open({ products: { status: 500, body: { message: 'Banco de dados indisponível' } } });
  assert.match(await page.evaluate(TEXT), /Banco de dados indisponível/);
  assert.equal(await page.evaluate(CARDS), 0);

  page.products = 'offline';
  await clickText(page, 'Tentar Novamente');
  await page.waitFor(`!state.loadingProducts && ${TEXT}.includes('Sem conexão com o servidor')`);

  page.products = undefined; // volta ao server.js
  await clickText(page, 'Tentar Novamente');
  await page.waitFor(`!state.loadingProducts && ${CARDS} > 0`);
  assert.doesNotMatch(await page.evaluate(TEXT), /Tentar Novamente|Sem conexão|indisponível/);
  await page.close();
});
