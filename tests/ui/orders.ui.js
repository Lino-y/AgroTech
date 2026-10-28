// Issue #25: "Meus Pedidos" exige login, carrega os pedidos do servidor ao abrir, continua com
// eles depois de recarregar a página, mostra a data real em dd/mm/aaaa e, se a API falhar, um
// aviso com "Tentar novamente". Roda no Chrome headless contra um banco descartável
// (`npm run test:ui`; base em tests/ui/browser.js).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

// A data da tela depende do fuso: a aba roda no de Brasília em qualquer máquina.
const TZ = 'America/Sao_Paulo';
const TEXT = "document.querySelector('#main-content').innerText";
// Ids dos pedidos na tela, na ordem dos cartões.
const SHOWN_IDS = "[...document.querySelectorAll('#main-content span')].map((el) => el.textContent.trim()).filter((text) => /^AGT-[0-9A-F]+$/.test(text))";
const SUBMIT = "document.querySelector('#main-content form button[type=\"submit\"]').click()";
const ONLINE = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const clickText = (page, text) => page.evaluate(`[...document.querySelectorAll('button')].find((el) => el.textContent.trim() === ${JSON.stringify(text)}).click()`);

// Abre "Meus Pedidos" sem login, que leva ao login, e entra com o usuário de exemplo do banco
// descartável (João Silva, dono do pedido AGT-84920 do seed); o login volta para os pedidos.
async function openOrdersAsDemo(page) {
  await page.send('Emulation.setTimezoneOverride', { timezoneId: TZ });
  await page.evaluate("navigateTo('orders')");
  assert.equal(await page.evaluate('state.activeScreen'), 'register', 'Meus Pedidos abriu sem login');
  await page.evaluate(`document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
    document.getElementById('loginPassword').value = 'demo123';
    ${SUBMIT}`);
  await page.waitFor(`state.activeScreen === 'orders' && ${SHOWN_IDS}.includes('AGT-84920')`);
}

test('sem login, Meus Pedidos leva ao login; ao entrar, lista os pedidos do servidor com a data em dd/mm/aaaa', { skip: skipReason }, async () => {
  const page = await app.open();
  await openOrdersAsDemo(page);
  const text = await page.evaluate(TEXT);
  // O pedido do seed foi gravado só com a data legível "15/Set/2026".
  assert.match(text, /AGT-84920\s+Data: 15\/09\/2026/);
  assert.doesNotMatch(text, /Hoje|Nenhum pedido|Carregando/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('o pedido fechado aparece com a data de hoje e continua na lista depois de recarregar a página', { skip: skipReason }, async () => {
  const page = await app.open();
  await openOrdersAsDemo(page);
  await page.evaluate("addToCart('2'); navigateTo('payment')");
  await page.evaluate(SUBMIT);
  await page.waitFor(`state.activeScreen === 'orders' && ${SHOWN_IDS}.length === 2`);
  const [newId] = await page.evaluate(SHOWN_IDS);
  const today = new Date().toLocaleDateString('pt-BR', { timeZone: TZ });
  assert.match(await page.evaluate(TEXT), new RegExp(`${newId}\\s+Data: ${today.replace(/\//g, '\\/')}`));

  // Marca no window: some quando a página recarrega de verdade.
  await page.evaluate('window.__antesDeRecarregar = true');
  await page.send('Page.reload');
  await page.waitFor('!window.__antesDeRecarregar && window.state && !state.loadingProducts');
  await page.evaluate("navigateTo('orders')");
  await page.waitFor(`${SHOWN_IDS}.length === 2`);
  assert.deepEqual(await page.evaluate(SHOWN_IDS), [newId, 'AGT-84920']);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('falha da API em Meus Pedidos mostra o aviso com "Tentar novamente", e a nova tentativa carrega a lista', { skip: skipReason }, async () => {
  const page = await app.open();
  await openOrdersAsDemo(page);
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', { ...ONLINE, offline: true });
  await page.evaluate("navigateTo('catalog'); navigateTo('orders')");
  await page.waitFor(`${TEXT}.includes('Sem conexão com o servidor')`);
  assert.deepEqual(await page.evaluate(SHOWN_IDS), []);
  assert.doesNotMatch(await page.evaluate(TEXT), /Nenhum pedido/);

  await page.send('Network.emulateNetworkConditions', ONLINE);
  await clickText(page, 'Tentar novamente');
  await page.waitFor(`${SHOWN_IDS}.includes('AGT-84920')`);
  assert.doesNotMatch(await page.evaluate(TEXT), /Sem conexão|Tentar novamente/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('conta nova sem pedido vê "Nenhum pedido encontrado", sem erro nem "carregando"', { skip: skipReason }, async () => {
  const page = await app.open();
  await page.evaluate("navigateTo('orders'); toggleAuthMode('register')");
  await page.evaluate(`document.getElementById('regName').value = 'Maria Souza';
    document.getElementById('regProp').value = 'Sítio Novo';
    document.getElementById('regEmail').value = 'maria-${Date.now()}@agrotech.dev';
    document.getElementById('regPassword').value = 'senha123';
    ${SUBMIT}`);
  await page.waitFor(`state.activeScreen === 'orders' && ${TEXT}.includes('Nenhum pedido encontrado')`);
  assert.doesNotMatch(await page.evaluate(TEXT), /Carregando|Tentar novamente/);
  assert.deepEqual(page.errors, []);
  await page.close();
});
