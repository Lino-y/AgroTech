// Storage da sessão (RN04): a sessão some da memória e do armazenamento seguro ao sair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSession, getSession, setSecureStore, setSession, type SecureStoreLike } from '../src/services/storage.ts';

function fakeStore(): SecureStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItemAsync(key) {
      return data.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      data.set(key, value);
    },
    async deleteItemAsync(key) {
      data.delete(key);
    }
  };
}

test('a sessão vai para o armazenamento seguro e volta dele', async () => {
  const store = fakeStore();
  setSecureStore(store);
  await clearSession();
  await setSession({ token: 'tok-1', user: { id: 'usr-1' } });
  assert.match(store.data.get('agrotech_session') ?? '', /tok-1/);

  // Um processo novo (memória vazia) lê a sessão do armazenamento seguro.
  await clearSession();
  store.data.set('agrotech_session', JSON.stringify({ token: 'tok-2', user: { id: 'usr-2' } }));
  assert.equal((await getSession())?.token, 'tok-2');

  await clearSession();
  setSecureStore(null);
});

test('sair limpa a memória e o armazenamento seguro', async () => {
  const store = fakeStore();
  setSecureStore(store);
  await setSession({ token: 'tok-3', user: {} });
  await clearSession();
  assert.equal(await getSession(), null);
  assert.equal(store.data.has('agrotech_session'), false);
  setSecureStore(null);
});

test('sem armazenamento seguro, a sessão vive só na memória', async () => {
  setSecureStore(null);
  await setSession({ token: 'tok-4', user: {} });
  assert.equal((await getSession())?.token, 'tok-4');
  await clearSession();
  assert.equal(await getSession(), null);
});
