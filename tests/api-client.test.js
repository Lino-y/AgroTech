// Issue #22: os cabeçalhos passados pelo chamador somam aos montados por apiRequest; não podem
// apagar o token nem o Content-Type. Teste no Node com fetch simulado, sem servidor.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = { agrotech_token: JSON.stringify('tok-123') };
globalThis.localStorage = {
  getItem: (key) => (Object.hasOwn(store, key) ? store[key] : null),
  setItem() {},
  removeItem() {}
};
const { apiRequest } = await import('../src/services/api.js');

test('options.headers do chamador soma aos cabeçalhos e não apaga o token', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  await apiRequest('/products', { headers: { 'X-Extra': '1' } });
  const headers = fetchMock.mock.calls[0].arguments[1].headers;
  assert.equal(headers.Authorization, 'Bearer tok-123');
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(headers['X-Extra'], '1');
});

test('options.headers do chamador pode sobrescrever um cabeçalho de propósito', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  await apiRequest('/products', { headers: { 'Content-Type': 'text/plain' } });
  assert.equal(fetchMock.mock.calls[0].arguments[1].headers['Content-Type'], 'text/plain');
});

test('o resto das opções (método, corpo) chega ao fetch', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  await apiRequest('/products/1', { method: 'PUT', body: '{"a":1}', headers: { 'X-Extra': '1' } });
  const [, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(options.method, 'PUT');
  assert.equal(options.body, '{"a":1}');
});

// --- parte 3c: pagamento pela web (api.js) ---
const { createOrder, loadAppConfig, syncOrder, cancelOrder } = await import('../src/services/api.js');

test('createOrder com chave manda Idempotency-Key e mantém o token e o Content-Type', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 201 }));
  await createOrder({ items: [], returnTo: 'web' }, 'ord-abc12345');
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/orders');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['Idempotency-Key'], 'ord-abc12345');
  assert.equal(options.headers.Authorization, 'Bearer tok-123');
  assert.equal(options.headers['Content-Type'], 'application/json');
});

test('createOrder sem chave, ou com chave undefined, não manda cabeçalho Idempotency-Key', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 201 }));
  await createOrder({ items: [] });
  await createOrder({ items: [] }, undefined);
  await createOrder({ items: [] }, '');
  for (const call of fetchMock.mock.calls) {
    assert.equal(call.arguments[1].headers['Idempotency-Key'], undefined);
  }
});

test('syncOrder e cancelOrder chamam o caminho e o método certos, e codificam o id', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  await syncOrder('AGT-B403E9D09B59');
  await cancelOrder('AGT-B403E9D09B59');
  await syncOrder('A/B');
  const [first, second, third] = fetchMock.mock.calls.map((call) => [call.arguments[0], call.arguments[1].method]);
  assert.deepEqual(first, ['/api/orders/AGT-B403E9D09B59/sync', 'POST']);
  assert.deepEqual(second, ['/api/orders/AGT-B403E9D09B59/cancel', 'POST']);
  assert.equal(third[0], '/api/orders/A%2FB/sync');
});

test('loadAppConfig pede /api/app-config por GET', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{"payments":"mercadopago"}', { status: 200 }));
  const config = await loadAppConfig();
  assert.equal(fetchMock.mock.calls[0].arguments[0], '/api/app-config');
  assert.equal(config.payments, 'mercadopago');
});
