// Storage isola sessão (RN04 da spec 08). O token fica no armazenamento seguro do aparelho
// (expo-secure-store, injetado na inicialização); sem ele, a sessão vive só na memória (testes).

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

/** Encerra a sessão local: some da memória e do armazenamento seguro. */
export async function clearSession(): Promise<void> {
  memorySession = null;
  if (secureStore) await secureStore.deleteItemAsync(KEY);
}
