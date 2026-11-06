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
