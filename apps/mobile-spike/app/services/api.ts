// Spike da issue #11 (Fase 0 da spec 08): cliente HTTP centralizado (RN03).
// Anexa o token, aplica timeout e trata 401/403 encerrando a sessão local.
// Política offline da ADR-0001: sem rede não há pedido; falha vira erro tipado.
import { getSession, clearSession } from './storage.ts';

// ponytail: sem @types/node no spike (deps novas só após o gate da ADR); tipo
// mínimo para o EXPO_PUBLIC_API_URL — upgrade: instalar @types/node na Fase 1.
type EnvLike = { EXPO_PUBLIC_API_URL?: string };
declare const process: { env: EnvLike } | undefined;
const env: EnvLike = typeof process !== 'undefined' ? process.env : {};

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  baseUrl?: string;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const base = baseUrl ?? env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

  const session = await getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.token}` } : {})
  };

  // AbortController é o timeout nativo da plataforma — nada de dependência nova.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (response.status === 401 || response.status === 403) {
        // Sessão expirada: encerra localmente (critério "401 encerra a sessão").
        await clearSession();
      }
      throw new ApiError(response.status, payload.message ?? 'Erro ao carregar dados do servidor.');
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
  } finally {
    clearTimeout(timer);
  }
}

export type Me = { user: { id: string; name: string; email: string; role: string } };

export function loadMe(baseUrl?: string): Promise<Me> {
  return apiRequest<Me>('/auth/me', { baseUrl });
}
