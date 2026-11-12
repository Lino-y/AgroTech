// Servidor que o app usa e a configuração dele (versões do app). Endereço salvo no aparelho.
// ponytail: qualquer pessoa pode apontar o app para outro servidor e digitar a senha lá. Serve para a
// fase de testes na rede local; esconder ou tirar esta opção antes de distribuir para produtores.
import type { AppConfig } from '../lib/server.ts';
import { apiRequest } from './api.ts';
import { readCache, removeCache, saveCache } from './storage.ts';

export async function loadSavedServer(): Promise<string | null> {
  return (await readCache<string>('server', null))?.data ?? null;
}

/** null volta ao endereço do APK. */
export async function saveServer(url: string | null): Promise<void> {
  if (url) await saveCache('server', url, null);
  else await removeCache('server');
}

/** Confere se há uma API do AgroTech no endereço (GET /api/health), em até 5 s. */
export async function checkServer(url: string): Promise<boolean> {
  try {
    const health = await apiRequest<{ ok?: boolean }>('/health', { baseUrl: url, timeoutMs: 5000 });
    return health?.ok === true;
  } catch {
    return false;
  }
}

export function loadAppConfig(): Promise<AppConfig> {
  return apiRequest<AppConfig>('/app-config', { timeoutMs: 5000 });
}
