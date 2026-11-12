// Leitura com cache (Fase 3 da spec 08, política da ADR-0001): com rede usa o servidor e grava;
// sem rede (status 0) mostra o último dado salvo, com a data. Erro do servidor não usa cache, e
// pedido nunca é feito offline (isso fica no checkout, não aqui).
import { ApiError } from './api.ts';
import { getSession, readCache, saveCache, type CacheKey } from './storage.ts';

/** savedAt null = dado ao vivo; com data = dado salvo, mostrado sem conexão. */
export type Cached<T> = { data: T; savedAt: string | null };

export async function withCache<T>(key: CacheKey, fetcher: () => Promise<T>, now = new Date()): Promise<Cached<T>> {
  // Pedidos e extrato são da conta: o dono do cache é o id do usuário da sessão.
  const session = await getSession();
  const owner = session ? String(session.user.id ?? '') : null;
  try {
    const data = await fetcher();
    await saveCache(key, data, owner, now);
    return { data, savedAt: null };
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      const cached = await readCache<T>(key, owner);
      if (cached) return { data: cached.data, savedAt: cached.savedAt };
    }
    throw err;
  }
}
