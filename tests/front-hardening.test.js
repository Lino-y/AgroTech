// Revisão geral do front (casos que só aparecem com falha real): sessão que expira, 403 de regra de
// negócio, requisição sem fim, armazenamento cheio, cache corrompido, resposta atrasada e a busca
// com acento e com o texto que o servidor grava escapado. Node puro, com fetch e localStorage simulados.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = {};
let quotaFull = false;
globalThis.localStorage = {
  getItem: (key) => (Object.hasOwn(store, key) ? store[key] : null),
  setItem(key, value) {
    if (quotaFull) throw new DOMException('armazenamento cheio', 'QuotaExceededError');
    store[key] = String(value);
  },
  removeItem(key) {
    delete store[key];
  }
};

const { apiRequest, setUnauthorizedHandler } = await import('../src/services/api.js');
const { getProducts, getToken, getUser, setProducts, writeStorage } = await import('../src/services/storage.js');
const { syncCatalog } = await import('../src/modules/catalog-sync.js');
const { syncOrders } = await import('../src/modules/orders-sync.js');
const { filterCatalogProducts } = await import('../src/services/catalog-view.js');

const signIn = () => {
  store.agrotech_token = JSON.stringify('tok-123');
  store.agrotech_user = JSON.stringify({ email: 'a@agrotech.dev' });
};
const reply = (status, message) => async () => new Response(JSON.stringify({ message }), { status });

// --- sessão: 401 encerra, 403 não ---
test('401 com token encerra a sessão: limpa o armazenamento e avisa a tela', async (t) => {
  signIn();
  const calls = [];
  setUnauthorizedHandler(() => calls.push('expirou'));
  t.mock.method(globalThis, 'fetch', reply(401, 'Token inválido ou expirado.'));
  await assert.rejects(apiRequest('/orders'), (error) => error.status === 401 && error.message === 'Token inválido ou expirado.');
  assert.deepEqual(calls, ['expirou']);
  assert.equal(getToken(), null);
  assert.equal(getUser(), null);
  setUnauthorizedHandler(null);
});

test('403 é regra de negócio (ex.: excluir o anúncio de outro) e não encerra a sessão', async (t) => {
  signIn();
  const calls = [];
  setUnauthorizedHandler(() => calls.push('expirou'));
  t.mock.method(globalThis, 'fetch', reply(403, 'Você não pode remover este produto.'));
  await assert.rejects(apiRequest('/products/1', { method: 'DELETE' }), (error) => error.status === 403);
  assert.deepEqual(calls, []);
  assert.equal(getToken(), 'tok-123');
  setUnauthorizedHandler(null);
});

test('401 de quem não estava logado (senha errada no login) não derruba nada', async (t) => {
  delete store.agrotech_token;
  const calls = [];
  setUnauthorizedHandler(() => calls.push('expirou'));
  t.mock.method(globalThis, 'fetch', reply(401, 'E-mail ou senha inválidos.'));
  await assert.rejects(apiRequest('/auth/login', { method: 'POST', body: '{}' }), { message: 'E-mail ou senha inválidos.' });
  assert.deepEqual(calls, []);
  setUnauthorizedHandler(null);
});

// --- requisição sem fim ---
test('a requisição tem limite de tempo, e o estouro tem mensagem própria', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new DOMException('o tempo acabou', 'TimeoutError');
  });
  await assert.rejects(apiRequest('/products'), { message: /demorou/ });
  assert.ok(fetchMock.mock.calls[0].arguments[1].signal instanceof AbortSignal, 'o fetch foi sem AbortSignal');
  fetchMock.mock.mockImplementation(async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(apiRequest('/products'), { message: /Sem conexão/ });
});

// --- armazenamento cheio e cache corrompido ---
test('localStorage cheio não derruba o fluxo: a gravação devolve false e o cache de produtos é descartado', () => {
  store.agrotech_products = JSON.stringify([{ id: 'velho' }]);
  quotaFull = true;
  try {
    assert.equal(writeStorage('qualquer', { a: 1 }), false);
    assert.doesNotThrow(() => setProducts([{ id: 'novo' }]));
  } finally {
    quotaFull = false;
  }
  // O cache velho não fica para trás ocupando o espaço que o token vai precisar.
  assert.equal(getProducts(), null);
});

test('cache de produtos que não é uma lista é ignorado', () => {
  for (const cached of ['{}', '"texto"', '42', 'null']) {
    store.agrotech_products = cached;
    assert.equal(getProducts(), null, `cache ${cached} deveria ser ignorado`);
  }
  store.agrotech_products = JSON.stringify([{ id: '1' }]);
  assert.deepEqual(getProducts(), [{ id: '1' }]);
});

// --- cargas ---
test('resposta atrasada de uma carga anterior não sobrescreve a do catálogo atual', async () => {
  const state = { products: [], loadingProducts: false, productsError: null };
  const waiting = [];
  const load = () => new Promise((resolve) => waiting.push(resolve));
  const deps = { load, persist() {}, render() {} };
  const first = syncCatalog(state, deps);
  const second = syncCatalog(state, deps);

  waiting[1]([{ id: 'novo' }]);
  await second;
  waiting[0]([{ id: 'velho' }]);
  await first;
  assert.deepEqual(state.products, [{ id: 'novo' }]);
  assert.equal(state.loadingProducts, false);
});

test('o "carregando" só desliga quando termina a carga mais recente', async () => {
  const state = { products: [], loadingProducts: false, productsError: null };
  const waiting = [];
  const load = () => new Promise((resolve) => waiting.push(resolve));
  const deps = { load, persist() {}, render() {} };
  const first = syncCatalog(state, deps);
  const second = syncCatalog(state, deps);

  waiting[0]([{ id: 'velho' }]);
  await first;
  assert.equal(state.loadingProducts, true, 'a carga mais recente ainda não terminou');
  waiting[1]([{ id: 'novo' }]);
  await second;
  assert.equal(state.loadingProducts, false);
});

test('resposta de pedidos que não é lista vira aviso na tela, sem lançar e sem prender o "carregando"', async () => {
  for (const answer of [null, {}, 'oops']) {
    const state = { orders: { list: [], loading: false, error: null } };
    await syncOrders(state, { load: async () => answer, render() {} });
    assert.equal(state.orders.loading, false);
    assert.deepEqual(state.orders.list, []);
    assert.equal(typeof state.orders.error, 'string', `resposta ${JSON.stringify(answer)} não virou aviso`);
  }
});

// --- busca ---
test('a busca ignora acento e aceita o texto que o servidor grava escapado', () => {
  const products = [
    { name: 'Ração Bovinos Corte', category: 'Rações' },
    { name: 'Bebedouro d&#39;água', category: 'Máquinas' },
    { name: 'Fertilizante &amp; Adubo', category: 'Fertilizantes' }
  ];
  const find = (term) => filterCatalogProducts(products, 'Todos', term).map((p) => p.name);
  assert.deepEqual(find('racao'), ['Ração Bovinos Corte']);
  assert.deepEqual(find('RAÇÃO'), ['Ração Bovinos Corte']);
  assert.deepEqual(find("d'agua"), ['Bebedouro d&#39;água']);
  assert.deepEqual(find('fertilizante & adubo'), ['Fertilizante &amp; Adubo']);
  // O texto escapado em si não é o que o usuário vê, então não deve casar.
  assert.deepEqual(find('39'), []);
  assert.deepEqual(find('amp'), []);
});

test('a busca não quebra com anúncio sem nome ou com a lista nula', () => {
  assert.deepEqual(filterCatalogProducts(null, 'Todos', 'x'), []);
  assert.deepEqual(filterCatalogProducts([{ category: 'Grãos' }, { name: null }], 'Todos', 'grãos').length, 1);
});
