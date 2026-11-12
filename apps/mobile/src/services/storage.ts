// Storage isola sessão e cache (RN04 da spec 08). O token fica no armazenamento seguro do aparelho
// (expo-secure-store); o cache offline, no armazenamento local (AsyncStorage). Os dois são injetados
// na inicialização do app; sem eles, tudo vive só na memória (testes no Node, sem módulo nativo).

export type Session = { token: string; user: Record<string, unknown> };

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const KEY = 'agrotech_session';
let secureStore: SecureStoreLike | null = null;
let memorySession: Session | null = null;

export function setSecureStore(store: SecureStoreLike | null): void {
  secureStore = store;
}

export async function getSession(): Promise<Session | null> {
  if (memorySession) return memorySession;
  if (!secureStore) return null;
  const raw = await secureStore.getItemAsync(KEY);
  if (!raw) return null;
  memorySession = JSON.parse(raw) as Session;
  return memorySession;
}

export async function setSession(session: Session): Promise<void> {
  memorySession = session;
  if (secureStore) await secureStore.setItemAsync(KEY, JSON.stringify(session));
}

/**
 * Encerra a sessão local: some da memória e do armazenamento seguro, e os dados pessoais salvos
 * para uso offline (pedidos, extrato) vão junto. Sair da conta e o 401 passam por aqui.
 */
export async function clearSession(): Promise<void> {
  memorySession = null;
  if (secureStore) await secureStore.deleteItemAsync(KEY);
  for (const key of USER_CACHE_KEYS) {
    try {
      await keyValue.removeItem(key);
    } catch {
      // Falha ao limpar o disco não impede sair; a leitura ainda confere o dono (readCache).
    }
  }
}

// --- Cache offline (Fase 3 da spec 08) ---

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Catálogo e carrinho não são de uma conta; pedidos e extrato são (dono = id do usuário). */
export type CacheKey = 'cache:catalog' | 'cache:orders' | 'cache:finance' | 'cart';
const USER_CACHE_KEYS: CacheKey[] = ['cache:orders', 'cache:finance'];

function memoryKeyValue(): KeyValueStore {
  const data = new Map<string, string>();
  return {
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

let keyValue: KeyValueStore = memoryKeyValue();

export function setKeyValueStore(store: KeyValueStore | null): void {
  keyValue = store ?? memoryKeyValue();
}

type CacheEntry<T> = { savedAt: string; owner: string | null; data: T };

/** Grava com a data e o dono. Falha (cota cheia, disco) não quebra o fluxo: só fica sem cache. */
export async function saveCache<T>(key: CacheKey, data: T, owner: string | null, now = new Date()): Promise<void> {
  const entry: CacheEntry<T> = { savedAt: now.toISOString(), owner, data };
  try {
    await keyValue.setItem(key, JSON.stringify(entry));
  } catch {
    // ponytail: sem cache quando o armazenamento falha; o app segue online normalmente.
  }
}

/** Lê o que foi salvo para este dono; null se não há, se está corrompido ou se é de outra conta. */
export async function readCache<T>(key: CacheKey, owner: string | null): Promise<{ savedAt: string; data: T } | null> {
  try {
    const raw = await keyValue.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.owner !== owner || typeof entry.savedAt !== 'string') return null;
    return { savedAt: entry.savedAt, data: entry.data };
  } catch {
    return null;
  }
}
