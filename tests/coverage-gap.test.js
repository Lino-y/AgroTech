// Cobertura dos módulos pequenos que os testes de fluxo não chegam a abrir: wrappers da API do
// cliente, componentes de tela vazia e gráfico, tracker, auth, carrinho e helpers de catálogo.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.localStorage = {
  getItem: (key) => (Object.hasOwn(store, key) ? store[key] : null),
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; }
};

const api = await import('../src/services/api.js');
const { renderCatalogEmptyState } = await import('../src/components/CatalogEmptyState.js');
const { renderFinanceChart } = await import('../src/components/FinanceChart.js');
const { OrderTracker, TRACKING_STAGES } = await import('../src/modules/tracker.js');
const { AuthService } = await import('../src/modules/auth.js');
const { CartEngine } = await import('../src/modules/cart.js');
const catalogService = await import('../src/services/catalog.js');
const { SupportBot } = await import('../src/modules/support.js');

const replyJson = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });

// --- wrappers da API do cliente: cada um chama a rota certa, com método e corpo certos ---
test('os wrappers da API do cliente chamam as rotas que o server.js declara', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', replyJson({ ok: true }));
  const calls = () => fetchMock.mock.calls.map((c) => {
    const [url, options] = c.arguments;
    return { url, method: options?.method || 'GET', body: options?.body };
  });

  await api.loadProducts();
  await api.registerUser({ email: 'a@b.dev' });
  await api.loginUser({ email: 'a@b.dev' });
  await api.createProduct({ name: 'Milho' });
  await api.createOrder({ items: [] });
  await api.createPayment({ method: 'pix' });
  await api.confirmPayment('pay 1');
  await api.loadOrders();
  await api.loadFinanceEntries();
  await api.createFinanceEntry({ value: 1 });
  await api.updateStore({ name: 'Loja' });
  await api.loadSellerStore('vendedor@agrotech.dev');
  await api.deleteProduct('p 7');
  await api.addReview('p 7', { text: 'bom', rating: 5 });
  await api.deleteReview('p 7', 'r 2');

  assert.deepEqual(calls(), [
    { url: '/api/products', method: 'GET', body: undefined },
    { url: '/api/auth/register', method: 'POST', body: JSON.stringify({ email: 'a@b.dev' }) },
    { url: '/api/auth/login', method: 'POST', body: JSON.stringify({ email: 'a@b.dev' }) },
    { url: '/api/products', method: 'POST', body: JSON.stringify({ name: 'Milho' }) },
    { url: '/api/orders', method: 'POST', body: JSON.stringify({ items: [] }) },
    { url: '/api/payments', method: 'POST', body: JSON.stringify({ method: 'pix' }) },
    { url: '/api/payments/pay%201/confirm', method: 'POST', body: undefined },
    { url: '/api/orders', method: 'GET', body: undefined },
    { url: '/api/finance/entries', method: 'GET', body: undefined },
    { url: '/api/finance/entries', method: 'POST', body: JSON.stringify({ value: 1 }) },
    { url: '/api/auth/store', method: 'PUT', body: JSON.stringify({ name: 'Loja' }) },
    { url: '/api/store/vendedor%40agrotech.dev', method: 'GET', body: undefined },
    { url: '/api/products/p%207', method: 'DELETE', body: undefined },
    { url: '/api/products/p%207/reviews', method: 'POST', body: JSON.stringify({ text: 'bom', rating: 5 }) },
    { url: '/api/products/p%207/reviews/r%202', method: 'DELETE', body: undefined }
  ]);
});

test('resposta 204 devolve null e resposta com corpo vira objeto', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await api.loadProducts(), null);
  t.mock.method(globalThis, 'fetch', replyJson({ items: [1, 2] }));
  assert.deepEqual(await api.loadOrders(), { items: [1, 2] });
});

test('erro sem mensagem no corpo usa a mensagem padrão', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>corrompido</html>', { status: 500 }));
  await assert.rejects(api.loadProducts(), { message: 'Erro ao carregar dados do servidor.' });
});

// --- estados vazios e gráfico ---
test('estado vazio de catálogo: busca diz "nenhum encontrado"; catálogo vazio oferece anunciar', () => {
  const search = renderCatalogEmptyState('search', true);
  assert.match(search, /data-empty="search"/);
  assert.match(search, /Nenhum anúncio encontrado/);

  const guest = renderCatalogEmptyState('catalog', false);
  assert.match(guest, /data-empty="catalog"/);
  assert.match(guest, /Nenhum anúncio publicado/);
  assert.ok(!guest.includes('navigateTo'), 'visitante não ganha botão de anunciar');

  const seller = renderCatalogEmptyState('catalog', true);
  assert.match(seller, /navigateTo\('sell'\)/);
});

test('gráfico do financeiro formata valores e aceita lista vazia/entrada sem campos', () => {
  const empty = renderFinanceChart();
  assert.match(empty, /Movimentação Mensal/);
  assert.ok(!empty.includes('formatMoney'), 'sem dados, nenhuma barra é desenhada');

  const html = renderFinanceChart([
    { month: 'Jan', income: 12500, expense: 0 },
    { month: 'Fev', income: 900, expense: 400 },
    { month: 'Mar', income: 0.4, expense: 0.2 }
  ]);
  assert.match(html, /R\$ 12,5k/); // >= 1000 vira "12,5k"
  assert.match(html, /R\$ 400/);   // valor inteiro abaixo de 1000
  assert.match(html, /—/);         // zero/nulo vira travessão
  assert.match(html, /height: 100%/); // barra máxima ocupa tudo
});

// --- tracker ---
test('advanceOrder avança estágio, marca timeline e não passa do último', () => {
  const tracker = new OrderTracker();
  const order = { id: 'o1', status: TRACKING_STAGES[0], statusStep: 1 };
  const next = tracker.advanceOrder(order);

  assert.equal(next.statusStep, 2);
  assert.equal(next.status, TRACKING_STAGES[1]);
  assert.equal(next.timeline.length, TRACKING_STAGES.length);
  assert.equal(next.timeline[0].time, 'Concluído');
  assert.match(next.timeline[1].time, /Hoje às \d\d:\d\d/);
  assert.equal(next.timeline[2].completed, false);
  assert.equal(next.timeline[3].time, 'Aguardando');

  // sem statusStep (pedido antigo) começa do 1; no último estágio não passa dele
  assert.equal(tracker.advanceOrder({ id: 'o2' }).status, TRACKING_STAGES[1]);
  const last = tracker.advanceOrder({ id: 'o3', statusStep: TRACKING_STAGES.length });
  assert.equal(last.statusStep, TRACKING_STAGES.length);
  assert.equal(last.status, TRACKING_STAGES[TRACKING_STAGES.length - 1]);
});

test('track chama o primeiro estágio na hora e avança com o intervalo', async (t) => {
  const tracker = new OrderTracker();
  t.mock.timers.enable({ apis: ['setInterval'] });
  const seen = [];
  const timer = tracker.track('o1', (step, label) => seen.push([step, label]), 1000);
  assert.deepEqual(seen[0], [0, TRACKING_STAGES[0]]);

  t.mock.timers.tick(5000); // o 5º tick só limpa o timer (fim do último estágio)
  assert.equal(seen.length, 4); // passo inicial + 3 avanços; no 4º estágio o timer se encerra
  assert.deepEqual(seen[3], [3, TRACKING_STAGES[3]]);
  clearInterval(timer);
  t.mock.timers.reset();
});

// --- auth ---
test('AuthService: registra, valida e-mail, faz login e sai', () => {
  const auth = new AuthService();
  assert.throws(() => auth.register({ name: '', email: 'a@b.dev', password: 'x' }), /obrigat/);
  assert.throws(() => auth.register({ name: 'A', email: 'sem-arroba', password: 'x' }), /válid/);

  const user = auth.register({ name: 'Ana', email: 'Ana@AgroTech.dev ', password: '123', role: 'VENDEDOR' });
  assert.equal(user.email, 'ana@agrotech.dev');
  assert.equal(auth.currentUser.email, user.email);

  assert.throws(() => auth.login('', ''), /obrigat/);
  assert.throws(() => auth.login('ana@agrotech.dev', 'errada'), /incorretos/);
  assert.equal(auth.login('ANA@agrotech.dev', '123').email, 'ana@agrotech.dev');

  auth.logout();
  assert.equal(auth.currentUser, null);
  assert.equal(localStorage.getItem('agrotech_user'), null);
});

// --- carrinho ---
test('CartEngine: valida cupom vazio/inexistente/abaixo do mínimo, aplica, remove e soma', () => {
  const cart = new CartEngine([{ id: '1', price: 100, quantity: 1 }]);

  assert.deepEqual(cart.validateCoupon('  '), { valid: false, message: 'Digite um cupom.' });
  assert.equal(cart.validateCoupon('NAOEXISTE').valid, false);
  assert.equal(cart.validateCoupon('agro10').valid, false); // abaixo do mínimo, mensagem cita os valores
  assert.match(cart.validateCoupon('agro10').message, /a partir de R\$ 150\.00/);

  cart.addItem({ id: '2', price: 100, quantity: 1 });
  assert.equal(cart.validateCoupon('agro10').valid, true);

  const totals = cart.applyCoupon(' agro10 ');
  assert.equal(totals.appliedCoupon, 'AGRO10');
  assert.ok(totals.discount > 0);
  assert.equal(cart.calculateTotals().appliedCoupon, 'AGRO10');

  assert.equal(cart.calculateTotals().appliedCoupon, 'AGRO10');
  assert.equal(cart.removeCoupon().appliedCoupon, null);

  assert.deepEqual(cart.addItem(null), cart.cart); // produto nulo não altera nada
  cart.addItem({ id: '1', price: 100 }, 2);
  assert.equal(cart.cart.find((i) => i.id === '1').quantity, 3);
  cart.updateQuantity('1', -3); // zera: sai do carrinho
  assert.ok(!cart.cart.some((i) => i.id === '1'));
  cart.updateQuantity('inexistente', 1); // id que não está: nada muda
  cart.removeItem('2');
  assert.deepEqual(cart.cart, []);
});

// --- helpers de catálogo e suporte ---
test('estilo de categoria conhecida, desconhecida e rascunho de produto', () => {
  assert.equal(catalogService.getProductCategoryStyle('Grãos').emoji, '🌽');
  assert.deepEqual(catalogService.getProductCategoryStyle('Jardinagem'), { emoji: '📦', bg: '#F4FBF5' });
  assert.deepEqual(catalogService.getProductCategoryStyle(), catalogService.getProductCategoryStyle('Outros'));

  const draft = catalogService.buildProductDraft({
    name: 'Milho', price: '10', category: 'Grãos', imageUrl: '', userName: '', userEmail: 'a@b.dev'
  });
  assert.equal(draft.image, null); // sem foto, o campo fica nulo (não string vazia)
  assert.equal(draft.sellerName, 'Produtor Rural Anunciante');
  assert.equal(draft.price, 10);
  assert.equal(typeof draft.id, 'string');

  const named = catalogService.buildProductDraft({
    name: 'Feijão', price: 5, category: 'Outros', imageUrl: 'https://x.png', userName: 'Bia', userEmail: 'b@b.dev'
  });
  assert.equal(named.image, 'https://x.png');
  assert.equal(named.sellerName, 'Bia');
});

test('suporte: resposta padrão sugere atendente humano e é marcada como isHuman', () => {
  const bot = new SupportBot();
  const fallback = bot.reply('zzz mensagem sem chave zzz');
  assert.equal(fallback.isHuman, true);
  assert.match(fallback.text, /atendente humano/);
  assert.equal(bot.reply('quero falar com PESSOA').isHuman, true);
});

// --- módulo de telas (src/modules/catalog.js): roda sem DOM real, com dublês mínimos ---
test('handlers da tela de anúncio, carrinho, pedidos e perfil funcionam com dublês de DOM', async () => {
  const domFields = new Map();
  const toasts = [];
  // showToast anexa o toast ao #toast-root; capturamos por ali (a função interna não lê window.showToast).
  domFields.set('toast-root', { appendChild: (toast) => toasts.push(`${toast.className}|${toast.textContent}`), style: {} });
  globalThis.document = {
    readyState: 'complete',
    getElementById: (id) => domFields.get(id) ?? null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => ({ className: '', textContent: '', remove() {} })
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.activeTrackingTimers = {};
  globalThis.window.open = () => {};
  globalThis.confirm = () => true;
  globalThis.FileReader = class {
    readAsDataURL() { this.onload({ target: { result: 'data:image/png;base64,AAA' } }); }
  };
  globalThis.setInterval = () => 7; // startOrderLiveTracking: sem timer real no teste
  globalThis.clearInterval = () => {};

  await import('../src/modules/catalog.js').catch(() => null);
  const w = globalThis.window;
  const state = w.state;
  assert.ok(state, 'window.state deve existir');

  // showToast: guarda as mensagens para os handlers afirmarem sobre elas
  
  // Carrinho: adiciona, muda quantidade, remove; cupom entra e sai
  state.products = [{ id: 'p1', name: 'Milho', price: 100, category: 'Grãos', ownerEmail: 'x@y.dev' }];
  state.user = { name: 'Ana', email: 'demo@agrotech.com.br', favorites: [] };
  w.addToCart('p1');
  assert.equal(state.cart.length, 1);
  w.changeCartQuantity('p1', 2);
  assert.equal(state.cart[0].quantity, 3);
  w.removeFromCart('p1');
  assert.deepEqual(state.cart, []);

  // Navegação guarda a tela pendente quando exige login e o usuário não entrou
  state.user = { name: '', email: '' };
  w.navigateTo('finance');
  assert.equal(state.activeScreen, 'register');
  assert.equal(state.pendingScreen, 'finance');
  assert.equal(state.searchTerm, ''); // trocar de tela apaga a busca
  // Usuário logado entra direto; a tela pendente continua até o login concluí-la (handleLogin)
  state.user = { name: 'Ana', email: 'a@b.dev', favorites: [] };
  w.navigateTo('finance');
  assert.equal(state.activeScreen, 'finance');
  w.toggleAuthMode('register');
  assert.equal(state.authMode, 'register');
  w.applyCategoryFilter('Grãos');
  assert.equal(state.selectedCategory, 'Grãos');
  w.setFinanceFilter('INCOME');
  assert.equal(state.financeFilter, 'INCOME');
  w.setFinancePeriod(6);
  assert.equal(state.financePeriod, 6);
  w.setPaymentMethod('credit');
  assert.equal(state.paymentMethod, 'credit');
  w.setCreditInstallments(3);
  assert.equal(state.creditInstallments, 3);

  // Detalhe do produto abre e fecha; estrela da avaliação muda
  w.openProductDetail('p1');
  assert.equal(state.selectedProduct.id, 'p1');
  assert.equal(state.newRatingStar, 5);
  w.setNewRatingStar(3);
  assert.equal(state.newRatingStar, 3);
  w.closeProductDetail();
  assert.equal(state.selectedProduct, null);
  w.openProductDetail('inexistente');
  assert.equal(state.selectedProduct, null);

  // Favorito entra e sai da lista
  w.toggleFavorite('p1');
  assert.deepEqual(state.user.favorites, ['p1']);
  w.toggleFavorite('p1');
  assert.deepEqual(state.user.favorites, []);

  // Editor da loja abre, recebe campo e fecha
  w.openStoreEditor();
  assert.equal(state.storeEditor.open, true);
  w.updateStoreField('storeBio', 'Bio da loja');
  assert.equal(state.storeEditor.storeBio, 'Bio da loja');
  w.updateStoreField('x', 1); // sem editor aberto não faz nada
  w.closeStoreEditor();
  assert.equal(state.storeEditor, null);
  w.updateStoreField('storeBio', 'nada'); // fechado: ignora

  // Upload de foto: sem arquivo sai cedo; com imagem vira data URL no campo
  w.handleProductImageUpload({ target: { files: [] } });
  domFields.set('prodImage', { id: 'prodImage', value: '' });
  w.handleProductImageUpload({ target: { files: [{ type: 'image/png', size: 1000 }] } });
  assert.match(String(domFields.get('prodImage').value), /^data:image\/png/);
  const bigFile = { type: 'image/png', size: 2 * 1024 * 1024 };
  w.handleProductImageUpload({ target: { files: [bigFile] } });
  assert.ok(toasts.some((toast) => /muito grande/i.test(toast)), 'arquivo grande é recusado');

  // Busca: sem caixa de busca (tela antiga) sai sem erro
  w.applySearchFilter();
  domFields.set('searchInput', { value: 'milho' });
  w.applySearchFilter(); // sem cartões nem grade: só atualiza estado
  assert.equal(state.searchTerm, 'milho');

  // Chat: mensagem entra na conversa; vazia é ignorada
  const before = state.chatMessages.length;
  w.sendChatMessage('qual o frete?');
  assert.equal(state.chatMessages.length, before + 2);
  assert.equal(state.chatMessages.at(-1).sender, 'bot');
  w.sendChatMessage('');
  assert.equal(state.chatMessages.length, before + 2);
  w.sendChatMessage(); // sem input e sem texto: nada muda
  assert.equal(state.chatMessages.length, before + 2);

  // Rastreio: pedido do estado avança; pedido que não existe não quebra
  state.orders = { list: [{ id: 'AGT-1', statusStep: 1, status: 'Pedido Confirmado' }], loading: false, error: null };
  w.simulateOrderStep('AGT-1');
  assert.equal(state.orders.list[0].statusStep, 2);
  w.simulateOrderStep('nao-existe');
  w.startOrderLiveTracking('nao-existe'); // agenda timer, sem pedido não faz nada
  clearInterval(7);

  // Pagamento sem carrinho mostra aviso e não chama o servidor
  state.cart = [];
  await w.processPayment();
  assert.match(toasts.at(-1), /carrinho está vazio/i);

  // IA do anúncio: prompt curto mostra erro; prompt completo preenche os campos
  domFields.set('aiPrompt', { value: 'oi' });
  w.aiFillProduct();
  assert.match(toasts.at(-1), /Descreva/);
  domFields.set('aiPrompt', { value: 'milho para plantio, 40 toneladas, R$ 320, em Rio Verde - GO, com laudo, nota fiscal e registro mapa' });
  for (const id of ['prodName', 'prodPrice', 'prodUnit', 'prodCategory', 'prodStock', 'prodLocation', 'prodCert', 'prodDesc']) {
    domFields.set(id, { id, value: '', style: {} });
  }
  w.aiFillProduct();
  assert.match(domFields.get('prodName').value, /Milho/i);
  assert.equal(domFields.get('prodPrice').value, '320.00');
  assert.ok(Number(domFields.get('prodStock').value) > 0);
  assert.match(domFields.get('prodLocation').value, /Rio Verde - GO/);
  assert.match(domFields.get('prodCert').value, /MAPA/);
  assert.ok(domFields.get('prodDesc').value.length > 20);
  // "crie uma descrição" monta a ficha técnica
  domFields.set('aiPrompt', { value: 'crie uma descrição para adubo npk, 20 kg, R$ 185' });
  w.aiFillProduct();
  assert.match(domFields.get('prodDesc').value, /FICHA TÉCNICA/);
  assert.match(domFields.get('prodDesc').value, /Categoria: Fertilizantes/);
});

test('publicação e exclusão de anúncio conversam com a API e atualizam a tela', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options?.method === 'POST' && url === '/api/products') {
      return new Response(JSON.stringify({ id: 'novo', name: 'Milho', price: 10 }), { status: 201 });
    }
    if (options?.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response('{}', { status: 200 });
  });
  const state = globalThis.window.state;
  const toasts = [];
  
  const fields = new Map([
    ['toast-root', { appendChild: (toast) => toasts.push(`${toast.className}|${toast.textContent}`), style: {} }],
    ['prodName', { value: 'Milho' }], ['prodPrice', { value: '10' }],
    ['prodUnit', { value: 'kg' }], ['prodCategory', { value: 'Grãos' }],
    ['prodStock', { value: '5' }], ['prodLocation', { value: 'Rio Verde - GO' }],
    ['prodShippingType', { value: 'CIF' }], ['prodCert', { value: 'MAPA' }],
    ['prodImage', { value: 'https://x.png' }], ['prodDesc', { value: 'Lote de milho' }]
  ]);
  globalThis.document.getElementById = (id) => fields.get(id) ?? null;

  state.user = { name: 'Ana', email: 'a@b.dev' };
  state.products = [];
  await globalThis.window.handlePublishProduct({ preventDefault() {} });
  assert.equal(state.products[0].id, 'novo');
  assert.ok(toasts.some((toast) => /publicado/i.test(toast)), 'publicação confirma com toast');
  assert.equal(state.activeScreen, 'catalog');

  // Campos incompletos não chamam a API
  fields.set('prodPrice', { value: '' });
  const callsBefore = fetchMock.mock.callCount();
  await globalThis.window.handlePublishProduct({ preventDefault() {} });
  assert.equal(fetchMock.mock.callCount(), callsBefore);
  assert.ok(toasts.some((toast) => /Preencha/i.test(toast)), 'campos incompletos são recusados');

  // Exclusão: servidor primeiro, depois a tela
  state.products = [{ id: 'novo', name: 'Milho' }];
  await globalThis.window.deleteProduct('novo');
  assert.deepEqual(state.products, []);
  assert.ok(toasts.some((toast) => /exclu/i.test(toast)), 'exclusão confirma com toast');
});

test('lancamento manual do financeiro valida titulo e valor', async () => {
  const toasts = [];
    const fields = new Map([
    ['toast-root', { appendChild: (toast) => toasts.push(`${toast.className}|${toast.textContent}`), style: {} }],
    ['txTitle', { value: '' }], ['txAmount', { value: '' }], ['txType', { value: 'INCOME' }]
  ]);
  globalThis.document.getElementById = (id) => fields.get(id) ?? null;

  await globalThis.window.handleAddTransaction({ preventDefault() {} });
  assert.ok(toasts.some((toast) => /Informe a descri/.test(toast)), 'recusado sem descrição/valor');

  fields.get('txTitle').value = 'Venda de milho';
  fields.get('txAmount').value = 'abc';
  await globalThis.window.handleAddTransaction({ preventDefault() {} });
  assert.ok(toasts.some((toast) => /Informe a descri/.test(toast)), 'recusado sem descrição/valor');
});
