// Cache local (RN04 da spec 08): data de gravação, dono, dado corrompido, cota cheia e limpeza ao sair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/services/api.ts';
import { withCache } from '../src/services/offline.ts';
import {
  clearSession,
  readCache,
  saveCache,
  setKeyValueStore,
  setSession,
  type KeyValueStore
} from '../src/services/storage.ts';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    }
  };
}

const NOW = new Date('2026-11-12T14:30:00Z');

test('salva e lê de volta com a data de gravação', async () => {
  setKeyValueStore(memoryStore());
  await saveCache('cache:catalog', [{ id: '1' }], null, NOW);
  const cached = await readCache<{ id: string }[]>('cache:catalog', null);
  assert.deepEqual(cached, { savedAt: NOW.toISOString(), data: [{ id: '1' }] });
});

test('dado de outra conta não é devolvido', async () => {
  setKeyValueStore(memoryStore());
  await saveCache('cache:orders', [{ id: 'PED-1' }], 'usr-ana', NOW);
  assert.equal(await readCache('cache:orders', 'usr-bia'), null);
  assert.ok(await readCache('cache:orders', 'usr-ana'));
});

test('dado corrompido vira cache vazio, sem erro', async () => {
  const store = memoryStore();
  store.data.set('cache:catalog', '{não é json');
  setKeyValueStore(store);
  assert.equal(await readCache('cache:catalog', null), null);
});

test('cota cheia (setItem falha) não quebra o fluxo', async () => {
  setKeyValueStore({
    async getItem() {
      return null;
    },
    async setItem() {
      throw new Error('database or disk is full');
    },
    async removeItem() {}
  });
  await saveCache('cache:catalog', [], null, NOW);
});

test('sair da conta apaga pedidos e extrato salvos, mas mantém catálogo e carrinho', async () => {
  const store = memoryStore();
  setKeyValueStore(store);
  await saveCache('cache:orders', [1], 'usr-ana', NOW);
  await saveCache('cache:finance', [2], 'usr-ana', NOW);
  await saveCache('cache:catalog', [3], null, NOW);
  await saveCache('cart', [4], null, NOW);
  await clearSession();
  assert.deepEqual([...store.data.keys()].sort(), ['cache:catalog', 'cart']);
});

test('withCache: com rede usa o dado ao vivo e grava para depois', async () => {
  setKeyValueStore(memoryStore());
  await setSession({ token: 'tok', user: { id: 'usr-ana' } });
  const live = await withCache('cache:orders', async () => [{ id: 'PED-1' }], NOW);
  assert.deepEqual(live, { data: [{ id: 'PED-1' }], savedAt: null });
  assert.ok(await readCache('cache:orders', 'usr-ana'));
});

test('withCache: sem rede devolve o salvo com a data; erro do servidor não usa cache', async () => {
  setKeyValueStore(memoryStore());
  await setSession({ token: 'tok', user: { id: 'usr-ana' } });
  await withCache('cache:finance', async () => [{ id: 'f1' }], NOW);
  const offline = await withCache('cache:finance', async () => {
    throw new ApiError(0, 'Sem conexão com o servidor.');
  });
  assert.deepEqual(offline, { data: [{ id: 'f1' }], savedAt: NOW.toISOString() });
  await assert.rejects(
    withCache('cache:finance', async () => {
      throw new ApiError(500, 'Erro interno.');
    }),
    (error: unknown) => error instanceof ApiError && error.status === 500
  );
  await clearSession();
});

test('withCache: sem rede e sem nada salvo, o erro de conexão sobe', async () => {
  setKeyValueStore(memoryStore());
  await setSession({ token: 'tok', user: { id: 'usr-ana' } });
  await assert.rejects(
    withCache('cache:orders', async () => {
      throw new ApiError(0, 'Sem conexão com o servidor.');
    }),
    (error: unknown) => error instanceof ApiError && error.status === 0
  );
  await clearSession();
});
