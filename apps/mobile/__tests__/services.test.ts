// Serviços de pedido, anúncio e financeiro: rota, método, corpo e cabeçalhos que vão para a API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addFinanceEntry, loadFinance } from '../src/services/finance.ts';
import { loadOrders, newIdempotencyKey, placeOrder } from '../src/services/orders.ts';
import { createProduct, deleteProduct } from '../src/services/products.ts';
import { clearSession, setSession } from '../src/services/storage.ts';

type Call = { url: string; method?: string; body: unknown; headers: Record<string, string> };

async function capture(status: number, reply: unknown, fn: () => Promise<unknown>): Promise<{ call: Call; result: unknown }> {
  const original = globalThis.fetch;
  let call: Call | null = null;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    call = {
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: init?.headers as Record<string, string>
    };
    return new Response(status === 204 ? null : JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await fn();
    return { call: call!, result };
  } finally {
    globalThis.fetch = original;
  }
}

test('pedido manda só id e quantidade, o cupom e a Idempotency-Key, e devolve o pedido do servidor', async () => {
  await setSession({ token: 'tok', user: { id: 'u1' } });
  const order = { id: 'PED-1', total: 754.82, status: 'Pedido Confirmado', items: [], createdAt: '2026-11-12T10:00:00Z' };
  const { call, result } = await capture(201, order, () => placeOrder([{ id: '3', quantity: 2 }], 'AGRO10', 'ord-abcdef123'));
  assert.match(call.url, /\/api\/orders$/);
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.body, { items: [{ id: '3', quantity: 2 }], coupon: 'AGRO10' });
  assert.equal(call.headers['Idempotency-Key'], 'ord-abcdef123');
  assert.equal((result as { total: number }).total, 754.82);
  await clearSession();
});

test('a chave de idempotência tem o formato que a API aceita e não se repete', () => {
  const a = newIdempotencyKey();
  const b = newIdempotencyKey();
  assert.match(a, /^[A-Za-z0-9_-]{8,64}$/);
  assert.notEqual(a, b);
});

test('lista de pedidos é GET /api/orders', async () => {
  const { call } = await capture(200, [], () => loadOrders());
  assert.match(call.url, /\/api\/orders$/);
  assert.equal(call.method, 'GET');
});

test('anunciar manda os campos do formulário para POST /api/products', async () => {
  const input = { name: 'Milho', price: 450, category: 'Grãos', description: 'Saco 20 kg', unit: 'saco', stock: 10, location: 'Sorriso - MT' };
  const { call } = await capture(201, { id: 'prd-1', ...input }, () => createProduct(input));
  assert.match(call.url, /\/api\/products$/);
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.body, input);
});

test('excluir anúncio é DELETE /api/products/:id', async () => {
  const { call } = await capture(204, null, () => deleteProduct('prd-1'));
  assert.match(call.url, /\/api\/products\/prd-1$/);
  assert.equal(call.method, 'DELETE');
});

test('financeiro lê o extrato e grava lançamento manual', async () => {
  const listed = await capture(200, [], () => loadFinance());
  assert.match(listed.call.url, /\/api\/finance\/entries$/);
  const created = await capture(201, { id: 'f1' }, () => addFinanceEntry({ title: 'Diesel', amount: 300, type: 'EXPENSE' }));
  assert.equal(created.call.method, 'POST');
  assert.deepEqual(created.call.body, { title: 'Diesel', amount: 300, type: 'EXPENSE' });
});
