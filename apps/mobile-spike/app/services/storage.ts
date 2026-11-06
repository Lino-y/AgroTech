// Spike da issue #11 (Fase 0 da spec 08): storage isola sessão, cache e fila.
// Segredo de autenticação usa armazenamento seguro quando disponível
// (expo-secure-store); o fallback em memória cobre testes e web.
// RN04 (spec 08): storage service é a única porta de sessão/cache/fila.

export type Session = { token: string; user: Record<string, unknown> };

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

let secureStore: SecureStoreLike | null = null;
let memorySession: Session | null = null;

/** Injeção do expo-secure-store; chamado pelo app na inicialização real. */
export function setSecureStore(store: SecureStoreLike | null): void {
  secureStore = store;
}

export async function getSession(): Promise<Session | null> {
  if (memorySession) return memorySession;
  if (!secureStore) return null;
  const raw = await secureStore.getItemAsync('agrotech_session');
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function setSession(session: Session): Promise<void> {
  memorySession = session;
  if (secureStore) {
    await secureStore.setItemAsync('agrotech_session', JSON.stringify(session));
  }
}

/** Logout: limpa memória e armazenamento seguro (critério "token removido"). */
export async function clearSession(): Promise<void> {
  memorySession = null;
  if (secureStore) {
    await secureStore.deleteItemAsync('agrotech_session');
  }
}
