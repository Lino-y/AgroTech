import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  store: {},
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  }
};

const { calculateCartSummary, validateEmail, validateCouponCode } = await import('../src/services/commerce.js');
const { addProductToCart, removeProductFromCart, updateCartItemQuantity } = await import('../src/services/cart.js');
const { CartEngine } = await import('../src/modules/cart.js');
const { AuthService } = await import('../src/modules/auth.js');
const { OrderTracker, TRACKING_STAGES } = await import('../src/modules/tracker.js');
const { SupportBot } = await import('../src/modules/support.js');
const { buildSupportReply } = await import('../src/services/support.js');
const { loadCatalog } = await import('../src/services/catalog-load.js');
const api = await import('../src/services/api.js');
const { getToken, getUser, removeToken, setToken, setUser } = await import('../src/services/storage.js');

test('cálculo do carrinho aplica cupom de desconto corretamente', () => {
  const cart = [
    { id: 'p1', price: 100, quantity: 2 },
    { id: 'p2', price: 250, quantity: 1 }
  ];

  const summary = calculateCartSummary(cart, 'AGRO10');

  assert.equal(summary.subtotal, 450);
  assert.equal(summary.discount, 45);
  assert.equal(summary.shipping, 35);
  assert.equal(summary.total, 440);
});

test('cálculo do carrinho com frete grátis por valor alto', () => {
  const cart = [
    { id: 'p1', price: 500, quantity: 2 }
  ];

  const summary = calculateCartSummary(cart, 'FRETEGRATIS');

  assert.equal(summary.shipping, 0);
  assert.equal(summary.total, 1000);
});

test('addProductToCart aumenta quantidade do produto existente', () => {
  const cart = [{ id: 'p1', name: 'Ração', price: 50, quantity: 1 }];
  const updated = addProductToCart(cart, { id: 'p1', name: 'Ração', price: 50 });

  assert.equal(updated[0].quantity, 2);
});

test('removeProductFromCart remove item corretamente', () => {
  const cart = [{ id: 'p1', name: 'Ração', price: 50, quantity: 1 }, { id: 'p2', name: 'Fertilizante', price: 120, quantity: 1 }];
  const updated = removeProductFromCart(cart, 'p1');

  assert.deepEqual(updated, [{ id: 'p2', name: 'Fertilizante', price: 120, quantity: 1 }]);
});

test('valida e-mail corretamente', () => {
  assert.equal(validateEmail('teste@fazenda.com'), true);
  assert.equal(validateEmail('email-invalido'), false);
});

test('AuthService registra e autentica usuário com sucesso', () => {
  const service = new AuthService();
  const user = service.register({
    name: 'Maria do Campo',
    email: 'maria@fazenda.com',
    password: '123456',
    role: 'PRODUTOR',
    propertyOrCompany: 'Fazenda Sol Nascente'
  });

  assert.equal(user.email, 'maria@fazenda.com');
  assert.equal(service.login('maria@fazenda.com', '123456').email, 'maria@fazenda.com');
});

test('buildSupportReply gera resposta adequada para rastreio', () => {
  const response = buildSupportReply('rastrear meu pedido', { propertyOrCompany: 'Fazenda Nova' });

  assert.match(response.text, /rastreio|Meus Pedidos/i);
  assert.equal(response.nextScreen, 'orders');
});

test('validação dos 4 cupons rurais (AGRO10, FRETEGRATIS, NOVOCLIENTE, COLHEITA20)', () => {
  // Teste NOVOCLIENTE (R$ 25 off com min 100)
  assert.equal(validateCouponCode('NOVOCLIENTE', 50).valid, false);
  const novoCliente = validateCouponCode('NOVOCLIENTE', 150);
  assert.equal(novoCliente.valid, true);
  const summaryNovo = calculateCartSummary([{ id: '1', price: 150, quantity: 1 }], 'NOVOCLIENTE');
  assert.equal(summaryNovo.discount, 25);

  // Teste COLHEITA20 (20% off com min 800)
  assert.equal(validateCouponCode('COLHEITA20', 799).valid, false);
  const colheita = validateCouponCode('COLHEITA20', 1000);
  assert.equal(colheita.valid, true);
  const summaryColheita = calculateCartSummary([{ id: '1', price: 1000, quantity: 1 }], 'COLHEITA20');
  assert.equal(summaryColheita.discount, 200);
  assert.equal(summaryColheita.shipping, 0); // Frete grátis automático > 800

  // Teste cupom inválido
  assert.equal(validateCouponCode('INEXISTENTE', 1000).valid, false);
});

test('updateCartItemQuantity incrementa, decrementa e remove ao zerar', () => {
  let cart = [{ id: 'p1', name: 'Semente', price: 100, quantity: 2 }];
  cart = updateCartItemQuantity(cart, 'p1', 1);
  assert.equal(cart[0].quantity, 3);

  cart = updateCartItemQuantity(cart, 'p1', -1);
  assert.equal(cart[0].quantity, 2);

  cart = updateCartItemQuantity(cart, 'p1', -2);
  assert.equal(cart.length, 0);
});

test('CartEngine gerencia produtos e regras de desconto', () => {
  const engine = new CartEngine();
  engine.addItem({ id: 'p1', price: 200, name: 'NPK' }, 1);
  engine.addItem({ id: 'p1', price: 200, name: 'NPK' }, 1);
  assert.equal(engine.cart[0].quantity, 2);

  const totalsAgro10 = engine.applyCoupon('AGRO10');
  assert.equal(totalsAgro10.subtotal, 400);
  assert.equal(totalsAgro10.discount, 40);

  engine.removeCoupon();
  const totalsWithoutCoupon = engine.calculateTotals();
  assert.equal(totalsWithoutCoupon.discount, 0);
});

test('OrderTracker avança corretamente pelos 4 estágios de entrega', () => {
  assert.equal(TRACKING_STAGES.length, 4);
  const tracker = new OrderTracker();

  let order = {
    id: 'AGT-12345',
    status: 'Pedido Confirmado',
    statusStep: 1,
    timeline: []
  };

  order = tracker.advanceOrder(order);
  assert.equal(order.statusStep, 2);
  assert.equal(order.status, 'Insumos em Separação no CD');

  order = tracker.advanceOrder(order);
  assert.equal(order.statusStep, 3);
  assert.equal(order.status, 'Saiu para Entrega');

  order = tracker.advanceOrder(order);
  assert.equal(order.statusStep, 4);
  assert.equal(order.status, 'Entregue na Fazenda');
  assert.equal(order.timeline[3].completed, true);

  // Não ultrapassa o último estágio
  order = tracker.advanceOrder(order);
  assert.equal(order.statusStep, 4);
});

test('SupportBot reconhece palavras-chave e realiza escalonamento para atendente humano', () => {
  const bot = new SupportBot();

  const replyPix = bot.reply('como pago por pix?');
  assert.equal(replyPix.isHuman, false);
  assert.match(replyPix.text, /pix/i);

  const replyBoleto = bot.reply('quero pagar no boleto');
  assert.equal(replyBoleto.isHuman, false);
  assert.match(replyBoleto.text, /boleto/i);

  const replyHuman = bot.reply('preciso de um atendente humano agora');
  assert.equal(replyHuman.isHuman, true);
  assert.match(replyHuman.text, /humano|especializado/i);
});

test('buildSupportReply oferece transferência quando solicitado', () => {
  const reply = buildSupportReply('falar com atendente');
  assert.equal(reply.isHuman, true);
  assert.match(reply.text, /atendente|especialista/i);
});

// Limites das regras de carrinho: cada teste abaixo mata um mutante que passava ileso.
test('frete grátis só acima de R$ 800 (RF03): exatamente R$ 800 ainda paga frete', () => {
  assert.equal(calculateCartSummary([{ id: '1', price: 800, quantity: 1 }]).shipping, 35);
  assert.equal(calculateCartSummary([{ id: '1', price: 800.01, quantity: 1 }]).shipping, 0);
});

test('cupom FRETEGRATIS zera o frete abaixo de R$ 800', () => {
  const cart = [{ id: '1', price: 500, quantity: 1 }];
  assert.equal(calculateCartSummary(cart).shipping, 35);
  assert.equal(calculateCartSummary(cart, 'FRETEGRATIS').shipping, 0);
  assert.equal(calculateCartSummary(cart, 'FRETEGRATIS').total, 500);
});

test('cupom vale a partir do valor mínimo, inclusive', () => {
  assert.equal(validateCouponCode('AGRO10', 150).valid, true);
  assert.equal(validateCouponCode('AGRO10', 149.99).valid, false);
  assert.equal(calculateCartSummary([{ id: '1', price: 150, quantity: 1 }], 'AGRO10').discount, 15);
});

test('resumo do carrinho não aplica cupom abaixo do mínimo', () => {
  const summary = calculateCartSummary([{ id: '1', price: 100, quantity: 1 }], 'AGRO10');
  assert.equal(summary.discount, 0);
  assert.equal(summary.total, 135);
});

test('e-mail sem ponto no domínio é inválido', () => {
  assert.equal(validateEmail('produtor@fazenda'), false);
  assert.equal(validateEmail(' produtor@fazenda.com.br '), true);
});

test('adicionar produto nulo não altera o carrinho', () => {
  const cart = [{ id: 'p1', price: 50, quantity: 1 }];
  assert.equal(addProductToCart(cart, null), cart);
});

// Carga do catálogo pela API (issue #4): o que a tela recebe em cada desfecho.
test('catálogo da API: sucesso troca os produtos da tela, sem erro', async () => {
  const products = [{ id: '1', name: 'Milho Híbrido' }];
  assert.deepEqual(await loadCatalog(async () => products), { products, productsError: null });
});

test('catálogo da API vazio esvazia a tela em vez de manter o cache local', async () => {
  assert.deepEqual(await loadCatalog(async () => []), { products: [], productsError: null });
});

test('falha da API vira erro recuperável e mantém os produtos que a tela já mostra', async () => {
  const fail = (error) => () => Promise.reject(error);
  assert.deepEqual(await loadCatalog(fail(new Error('Servidor fora do ar'))), { productsError: 'Servidor fora do ar' });
  // Sem mensagem, a tela esconderia o aviso e o botão "Tentar Novamente".
  assert.deepEqual(await loadCatalog(fail(new Error(''))), { productsError: 'Falha ao carregar produtos da API' });
  assert.deepEqual(await loadCatalog(async () => ({ message: 'oops' })), { productsError: 'Formato inválido de dados recebidos da API' });
});

test('sem conexão, a API devolve aviso em português em vez do erro do navegador', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(api.apiRequest('/products'), { message: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' });
});

test('apiRequest manda o token salvo e devolve o JSON; resposta 204 vira null', async (t) => {
  setToken('tok-123');
  t.after(removeToken);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{"ok":true}', { status: 200 }));
  assert.deepEqual(await api.apiRequest('/products'), { ok: true });
  assert.equal(fetchMock.mock.calls[0].arguments[1].headers.Authorization, 'Bearer tok-123');
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 204 }));
  assert.equal(await api.apiRequest('/products/1', { method: 'DELETE' }), null);
});

test('apiRequest: 401 encerra a sessão salva e repassa a mensagem do servidor', async (t) => {
  setToken('tok-123');
  setUser({ email: 'produtor@agrotech.dev' });
  t.mock.method(globalThis, 'fetch', async () => new Response('{"message":"Sessão expirada"}', { status: 401 }));
  await assert.rejects(api.apiRequest('/orders'), { message: 'Sessão expirada' });
  assert.equal(getToken(), null);
  assert.equal(getUser(), null);
});

test('cada função da API chama a rota e o método que o server.js declara', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  const routes = [
    [() => api.loadProducts(), 'GET /api/products'],
    [() => api.registerUser({}), 'POST /api/auth/register'],
    [() => api.loginUser({}), 'POST /api/auth/login'],
    [() => api.createProduct({}), 'POST /api/products'],
    [() => api.createOrder({}), 'POST /api/orders'],
    [() => api.loadOrders(), 'GET /api/orders'],
    [() => api.updateStore({}), 'PUT /api/auth/store'],
    [() => api.deleteProduct('lote 1'), 'DELETE /api/products/lote%201'],
    [() => api.addReview('p1', {}), 'POST /api/products/p1/reviews'],
    [() => api.deleteReview('p1', 'r1'), 'DELETE /api/products/p1/reviews/r1']
  ];
  for (const [call, route] of routes) {
    await call();
    const [url, options] = fetchMock.mock.calls.at(-1).arguments;
    assert.equal(`${options.method || 'GET'} ${url}`, route);
  }
});
