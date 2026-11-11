// Cliente HTTP do app: token, 401/403 e erro de rede. Roda no Node, sem React Native.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, apiRequest } from '../src/services/api.ts';
import { clearSession, getSession, setSession } from '../src/services/storage.ts';

const BASE = 'http://api.test';

async function withFetch(response: () => Response | Promise<Response>, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => response()) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('anexa o token da sessão no cabeçalho Authorization', async () => {
  await setSession({ token: 'tok-123', user: { id: 'usr-1' } });
  let sent: string | null = null;
  await withFetch(
    () => json(200, { ok: true }),
    async () => {
      globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
        sent = (init?.headers as Record<string, string>).Authorization;
        return json(200, { ok: true });
      }) as typeof fetch;
      await apiRequest('/auth/me', { baseUrl: BASE });
    }
  );
  assert.equal(sent, 'Bearer tok-123');
  await clearSession();
});

test('401 de quem tinha token encerra a sessão local e devolve a mensagem do servidor', async () => {
  await setSession({ token: 'tok-expirado', user: { id: 'usr-1' } });
  await withFetch(
    () => json(401, { message: 'Sessão encerrada. Entre de novo.' }),
    async () => {
      await assert.rejects(apiRequest('/products', { baseUrl: BASE }), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        assert.equal(error.message, 'Sessão encerrada. Entre de novo.');
        return true;
      });
    }
  );
  assert.equal(await getSession(), null);
});

test('403 é regra de negócio: a sessão continua', async () => {
  await setSession({ token: 'tok-ok', user: { id: 'usr-1' } });
  await withFetch(
    () => json(403, { message: 'Você só pode excluir as suas próprias avaliações.' }),
    async () => {
      await assert.rejects(apiRequest('/products/1', { baseUrl: BASE, method: 'DELETE' }), ApiError);
    }
  );
  assert.equal((await getSession())?.token, 'tok-ok');
  await clearSession();
});

test('sem rede: erro tipado com status 0, e a sessão continua', async () => {
  await setSession({ token: 'tok-offline', user: { id: 'usr-1' } });
  await withFetch(
    () => {
      throw new TypeError('Network request failed');
    },
    async () => {
      await assert.rejects(apiRequest('/products', { baseUrl: BASE }), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 0);
        assert.match(error.message, /Sem conexão/);
        return true;
      });
    }
  );
  assert.equal((await getSession())?.token, 'tok-offline');
  await clearSession();
});

test('204 devolve undefined, sem tentar ler corpo', async () => {
  await withFetch(
    () => new Response(null, { status: 204 }),
    async () => {
      assert.equal(await apiRequest('/auth/logout', { baseUrl: BASE, method: 'POST' }), undefined);
    }
  );
});
