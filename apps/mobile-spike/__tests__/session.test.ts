// Testes do spike da issue #11 (Fase 0 da spec 08).
// Cobrem RN03 (api centraliza token/timeout/401) e RN04 (storage isola sessão).
// node --experimental-strip-types --test apps/mobile-spike/__tests__/

// ponytail: o spike não instala @types/node (deps novas só após o gate da ADR);
// os tipos de node:test/assert vêm junto na Fase 1.
// @ts-expect-error — node:test sem @types/node no spike
import test from 'node:test';
// @ts-expect-error — node:assert/strict sem @types/node no spike
import assert from 'node:assert/strict';

// Cada teste roda com um módulo recém-importado para não vazar sessão entre casos.
// (import com extensão .ts: exigência do node --experimental-strip-types)
async function freshServices() {
  const [storage, api] = await Promise.all([
    import('../app/services/storage.ts'),
    import('../app/services/api.ts')
  ]);
  storage.setSecureStore(null);
  await storage.clearSession();
  return { storage, api };
}



test('anexa o token da sessão no header Authorization', async () => {
  const { storage, api } = await freshServices();
  await storage.setSession({ token: 'tok-123', user: { id: 'usr-1' } });

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response('{"user":{"id":"usr-1"}}', { status: 200 });
  }) as typeof fetch;
  try {
    const me = await api.loadMe('http://test');
    assert.equal(me.user.id, 'usr-1');
    const first = calls.at(0);
    if (!first) throw new Error('fetch deve ter sido chamado uma vez');
    const headers = first.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer tok-123');
    assert.equal(first.url, 'http://test/api/auth/me');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sem sessão, a requisição não manda Authorization', async () => {
  const { api } = await freshServices();
  let seen: unknown;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url, init) => {
    seen = init?.headers;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  try {
    await api.apiRequest('/health', { baseUrl: 'http://test' });
    assert.equal((seen as Record<string, string>).Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('401 encerra a sessão local e devolve a mensagem do servidor', async () => {
  const { storage, api } = await freshServices();
  await storage.setSession({ token: 'tok-123', user: { id: 'usr-1' } });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('{"message":"Token inválido ou expirado."}', { status: 401 })) as typeof fetch;
  try {
    await assert.rejects(
      api.apiRequest('/auth/me', { baseUrl: 'http://test' }),
      (error: unknown) => {
        assert.ok(error instanceof api.ApiError);
        assert.equal((error as Error).message, 'Token inválido ou expirado.');
        assert.equal((error as { status: number }).status, 401);
        return true;
      }
    );
    assert.equal(await storage.getSession(), null, 'sessão deve ser removida no 401');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('403 também encerra a sessão local', async () => {
  const { storage, api } = await freshServices();
  await storage.setSession({ token: 'tok-123', user: { id: 'usr-1' } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{"message":"Acesso restrito."}', { status: 403 })) as typeof fetch;
  try {
    await assert.rejects(api.apiRequest('/orders', { baseUrl: 'http://test' }));
    assert.equal(await storage.getSession(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sem rede: erro tipado em português, sessão preservada (não é 401)', async () => {
  const { storage, api } = await freshServices();
  await storage.setSession({ token: 'tok-123', user: { id: 'usr-1' } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;
  try {
    await assert.rejects(
      api.apiRequest('/auth/me', { baseUrl: 'http://test' }),
      { message: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' }
    );
    assert.ok(await storage.getSession(), 'falha de rede não deve limpar a sessão');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiRequest devolve ApiError com o status na falha de rede (tela não desloga)', async () => {
  const { api } = await freshServices();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;
  try {
    await assert.rejects(
      api.apiRequest('/auth/me', { baseUrl: 'http://test' }),
      (error: unknown) => {
        assert.ok(error instanceof api.ApiError);
        assert.equal((error as { status: number }).status, 0);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('timeout aborta a requisição e vira erro de conexão', async () => {
  const { api } = await freshServices();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    })) as typeof fetch;
  try {
    await assert.rejects(
      api.apiRequest('/products', { baseUrl: 'http://test', timeoutMs: 20 }),
      { message: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('storage: set/get/clear em memória e no secure store fake', async () => {
  const { storage } = await freshServices();
  const backing = new Map<string, string>();
  storage.setSecureStore({
    getItemAsync: async (key) => backing.get(key) ?? null,
    setItemAsync: async (key, value) => {
      backing.set(key, value);
    },
    deleteItemAsync: async (key) => {
      backing.delete(key);
    }
  });

  await storage.setSession({ token: 'tok-secure', user: { email: 'demo@agrotech.com.br' } });
  assert.equal(backing.size, 1, 'sessão gravada no secure store');
  assert.equal((await storage.getSession())?.token, 'tok-secure');

  await storage.clearSession();
  assert.equal(backing.size, 0, 'logout apaga o secure store');
  assert.equal(await storage.getSession(), null);
});
