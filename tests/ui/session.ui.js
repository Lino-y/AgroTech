// Revisão geral do front, no Chrome headless (`npm run test:ui`): duplo toque no pagamento, estado da
// conta que sai, sessão que expira, detalhe do produto fora do catálogo, exclusão que espera o servidor
// e o "+" sobre o botão da tela de pagamento. Base em tests/ui/browser.js.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, startApp } from './browser.js';

let app;
before(async () => {
  if (!skipReason) app = await startApp();
});
after(() => app?.close());

const products = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, name: `Lote ${n}`, category: 'Sementes', price: 50, rating: 5, reviewsCount: 0 }));
const click = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);

// Entra com o usuário de exemplo do banco descartável, pelo ícone do carrinho.
async function login(page) {
  await click(page, `nav [onclick="navigateTo('cart')"]`);
  await page.evaluate(`(() => {
    document.getElementById('loginEmail').value = 'demo@agrotech.com.br';
    document.getElementById('loginPassword').value = 'demo123';
    document.querySelector('#main-content form button[type="submit"]').click();
  })()`);
  await page.waitFor("state.activeScreen === 'cart'");
}

test('duplo toque em "Confirmar Pagamento" cria um pedido só', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: [{ id: '1', name: 'Ração', category: 'Rações', price: 89.9, rating: 5, reviewsCount: 0 }] } });
  try {
    await click(page, `[onclick="addToCart('1')"]`);
    await login(page);
    await click(page, `[onclick="navigateTo('payment')"]`);
    await page.waitFor("state.activeScreen === 'payment'");
    // Rede lenta: a resposta demora, e o segundo toque chega com o primeiro pedido ainda em andamento.
    await page.evaluate(`(() => {
      const original = window.fetch;
      window.__orderPosts = 0;
      window.fetch = async (url, options) => {
        if (String(url) === '/api/orders' && options?.method === 'POST') {
          window.__orderPosts += 1;
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        return original(url, options);
      };
    })()`);
    await page.evaluate(`(() => {
      const button = document.querySelector('#main-content form button[type="submit"]');
      button.click();
      button.click();
    })()`);
    await page.waitFor("state.activeScreen === 'orders'");
    await page.evaluate('new Promise((resolve) => setTimeout(resolve, 600))');
    assert.equal(await page.evaluate('window.__orderPosts'), 1, 'o segundo toque criou outro pedido');
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('sair da conta limpa carrinho, cupom, moedas, busca e conversa', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: products } });
  try {
    await click(page, `[onclick="addToCart('p1')"]`);
    await login(page);
    await page.evaluate(`(() => {
      state.appliedCoupon = 'AGRO10';
      state.coins = 999;
      state.searchTerm = 'lote';
      state.selectedCategory = 'Sementes';
      sendChatMessage('quero falar do frete');
      window.confirm = () => true;
      handleLogout();
    })()`);
    const after = await page.evaluate(`({
      email: state.user.email, cart: state.cart.length, coupon: state.appliedCoupon, coins: state.coins,
      term: state.searchTerm, category: state.selectedCategory, chat: state.chatMessages.length, screen: state.activeScreen
    })`);
    assert.deepEqual(after, { email: '', cart: 0, coupon: null, coins: 350, term: '', category: 'Todos', chat: 1, screen: 'catalog' });
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('token que expirou leva de volta ao login, com o estado da conta limpo', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: products } });
  try {
    await click(page, `[onclick="addToCart('p1')"]`);
    await login(page);
    // Token que o servidor não aceita: a próxima chamada logada volta 401.
    await page.evaluate(`localStorage.setItem('agrotech_token', JSON.stringify('token-vencido'))`);
    await page.evaluate(`navigateTo('finance')`);
    await page.waitFor("state.activeScreen === 'register'");
    assert.deepEqual(await page.evaluate('({ email: state.user.email, mode: state.authMode, cart: state.cart.length })'), { email: '', mode: 'login', cart: 0 });
    assert.equal(await page.evaluate(`localStorage.getItem('agrotech_token')`), null);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('o detalhe do produto abre em qualquer tela e fecha ao trocar de tela', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: products } });
  try {
    await page.evaluate(`navigateTo('support')`);
    await page.evaluate(`openProductDetail('p2')`);
    assert.equal(await page.evaluate(`!!document.querySelector('[onclick="closeProductDetail()"]')`), true, 'o detalhe não apareceu fora do catálogo');
    await page.evaluate(`navigateTo('catalog')`);
    assert.equal(await page.evaluate(`!!document.querySelector('[onclick="closeProductDetail()"]')`), false);
    assert.equal(await page.evaluate('state.selectedProduct'), null);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('excluir anúncio espera o servidor: se ele recusa, o anúncio continua na tela', { skip: skipReason }, async () => {
  const page = await app.open({ products: { body: products } });
  try {
    await page.evaluate(`(() => {
      window.confirm = () => true;
      const original = window.fetch;
      window.__deleteStatus = 500;
      window.fetch = async (url, options) => options?.method === 'DELETE'
        ? new Response(JSON.stringify({ message: 'O servidor recusou.' }), { status: window.__deleteStatus })
        : original(url, options);
    })()`);
    await page.evaluate(`deleteProduct('p1')`);
    assert.equal(await page.evaluate(`state.products.some((p) => p.id === 'p1')`), true, 'o anúncio saiu da tela com o servidor recusando');
    assert.match(await page.evaluate(`document.getElementById('toast-root').innerText`), /O servidor recusou/);

    // 404: o anúncio já não existe no servidor, então sair da tela está certo.
    await page.evaluate(`window.__deleteStatus = 404`);
    await page.evaluate(`deleteProduct('p1')`);
    assert.equal(await page.evaluate(`state.products.some((p) => p.id === 'p1')`), false);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

// Mesma medição do carrinho (#42), agora na tela de pagamento: o "+" não pode cobrir o botão de confirmar.
const PAYMENT_LAYOUT = `(() => {
  const pay = document.querySelector('#main-content form button[type="submit"]');
  const scroller = pay.closest('div[style*="overflow-y: auto"]');
  scroller.scrollTop = scroller.scrollHeight;
  const box = pay.getBoundingClientRect();
  const fab = document.querySelector('#main-content button[title="Anunciar produto"]')?.getBoundingClientRect() ?? null;
  const overlap = fab !== null && box.left < fab.right && fab.left < box.right && box.top < fab.bottom && fab.top < box.bottom;
  const midX = (box.left + box.right) / 2;
  const midY = (box.top + box.bottom) / 2;
  const blocked = [[box.left + 1, midY], [midX, box.top + 1], [midX, midY], [midX, box.bottom - 1], [box.right - 1, midY]]
    .filter(([x, y]) => !pay.contains(document.elementFromPoint(x, y))).length;
  return { viewport: window.innerWidth, overlap, blocked };
})()`;

test('pagamento: o botão de confirmar fica inteiro e clicável em 360, 390 e 430 px', { skip: skipReason }, async () => {
  for (const width of [360, 390, 430]) {
    const page = await app.open({ products: { body: products }, width });
    try {
      await click(page, `[onclick="addToCart('p1')"]`);
      await login(page);
      await click(page, `[onclick="navigateTo('payment')"]`);
      await page.waitFor("state.activeScreen === 'payment'");
      await page.waitFor("!document.querySelector('#toast-root .toast')");
      const layout = await page.evaluate(PAYMENT_LAYOUT);
      assert.deepEqual({ width, overlap: layout.overlap, blocked: layout.blocked }, { width, overlap: false, blocked: 0 }, JSON.stringify(layout));
    } finally {
      await page.close();
    }
  }
});
