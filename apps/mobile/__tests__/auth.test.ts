// Login, cadastro e logout do app: a sessão vai para o storage seguro, e sair limpa mesmo sem rede.
import test from 'node:test';
import assert from 'node:assert/strict';
import { API_URL } from '../src/config.ts';
import { ApiError } from '../src/services/api.ts';
import { login, logout, register } from '../src/services/auth.ts';
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

async function withFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>, fn: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => impl(url, init)) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test('login grava o token no armazenamento seguro e devolve o usuário', async () => {
  const store = fakeStore();
  setSecureStore(store);
  await clearSession();
  await withFetch(
    (url, init) => {
      assert.match(url, /\/api\/auth\/login$/);
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({ token: 'tok-login', user: { id: 'usr-1', name: 'Ana', email: 'a@x.com', role: 'COMPRADOR' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    },
    async () => {
      const user = await login('a@x.com', 'senha123');
      assert.equal(user.name, 'Ana');
    }
  );
  assert.equal((await getSession())?.token, 'tok-login');
  assert.match(store.data.get('agrotech_session') ?? '', /tok-login/);
  await clearSession();
  setSecureStore(null);
});

test('logout avisa o servidor com o token e limpa a sessão local', async () => {
  const store = fakeStore();
  setSecureStore(store);
  await setSession({ token: 'tok-sair', user: {} });
  let calledWith: { url: string; method?: string; auth?: string } | null = null;
  await withFetch(
    (url, init) => {
      calledWith = { url, method: init?.method, auth: (init?.headers as Record<string, string>).Authorization };
      return new Response(null, { status: 204 });
    },
    async () => {
      await logout();
    }
  );
  assert.deepEqual(calledWith, { url: `${API_URL}/api/auth/logout`, method: 'POST', auth: 'Bearer tok-sair' });
  assert.equal(await getSession(), null);
  setSecureStore(null);
});

test('logout sem rede ainda limpa a sessão local (o aparelho não fica preso logado)', async () => {
  const store = fakeStore();
  setSecureStore(store);
  await clearSession();
  await withFetch(
    () => {
      throw new TypeError('Network request failed');
    },
    async () => {
      await logout();
    }
  );
  assert.equal(await getSession(), null);
  assert.equal(store.data.has('agrotech_session'), false);
  setSecureStore(null);
});

const NEW_ACCOUNT = { name: 'Ana Souza', email: 'ana@fazenda.com', password: 'segredo', role: 'PRODUTOR' as const, propertyOrCompany: 'Fazenda Boa' };

test('cadastro envia os dados, grava a sessão e devolve o usuário', async () => {
  const store = fakeStore();
  setSecureStore(store);
  await clearSession();
  await withFetch(
    (url, init) => {
      assert.match(url, /\/api\/auth\/register$/);
      assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), NEW_ACCOUNT);
      return new Response(JSON.stringify({ token: 'tok-reg', user: { id: 'usr-9', name: 'Ana Souza', email: 'ana@fazenda.com', role: 'PRODUTOR' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    },
    async () => {
      const user = await register(NEW_ACCOUNT);
      assert.equal(user.id, 'usr-9');
      const session = await getSession();
      assert.equal(session?.token, 'tok-reg');
    }
  );
});

test('cadastro com e-mail já usado devolve a mensagem do servidor e não grava sessão', async () => {
  const store = fakeStore();
  setSecureStore(store);
  await clearSession();
  await withFetch(
    () => new Response(JSON.stringify({ message: 'Este e-mail já está cadastrado.' }), { status: 409, headers: { 'Content-Type': 'application/json' } }),
    async () => {
      await assert.rejects(
        () => register(NEW_ACCOUNT),
        (error: unknown) => error instanceof ApiError && error.status === 409 && error.message === 'Este e-mail já está cadastrado.'
      );
      assert.equal(await getSession(), null);
    }
  );
});
