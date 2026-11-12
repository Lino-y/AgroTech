// Cliente HTTP único do app (RN03 da spec 08): põe o token, aplica timeout e trata erro com tipo.
// Política igual à da web (src/services/api.js): só 401 de quem tinha token encerra a sessão.
// 403 é regra de negócio (ex.: excluir o anúncio de outro) e não encerra nada.
import { API_URL, APP_VERSION } from '../config.ts';
import { clearSession, getSession } from './storage.ts';

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
  /** Cabeçalhos extras da rota (ex.: Idempotency-Key do pedido). */
  headers?: Record<string, string>;
};

// Quem ouve a queda da sessão (o App, para voltar a visitante). Um só ouvinte: há uma só tela raiz.
let sessionExpiredListener: (() => void) | null = null;

export function onSessionExpired(listener: (() => void) | null): void {
  sessionExpiredListener = listener;
}

// Quem ouve "app desatualizado" (426 da API, versão abaixo da mínima): o App mostra a tela de atualizar.
let appOutdatedListener: ((minVersion: string) => void) | null = null;

export function onAppOutdated(listener: ((minVersion: string) => void) | null): void {
  appOutdatedListener = listener;
}

// Endereço do servidor escolhido na tela "Servidor" (salvo no aparelho); sem ele, o do build (API_URL).
// O App aplica o salvo antes da primeira requisição.
let baseUrlOverride: string | null = null;

export function setApiBaseUrl(url: string | null): void {
  baseUrlOverride = url;
}

export function getApiBaseUrl(): string {
  return baseUrlOverride ?? API_URL;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, baseUrl = getApiBaseUrl(), timeoutMs = DEFAULT_TIMEOUT_MS, headers: extra = {} } = options;

  const session = await getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': APP_VERSION,
    ...extra,
    ...(session ? { Authorization: `Bearer ${session.token}` } : {})
  };

  // AbortController é o timeout nativo da plataforma: sem dependência nova.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string; minVersion?: string };
      if (response.status === 426) appOutdatedListener?.(payload.minVersion ?? '');
      if (response.status === 401 && session) {
        await clearSession();
        sessionExpiredListener?.();
      }
      throw new ApiError(response.status, payload.message ?? 'Erro ao carregar dados do servidor.');
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // O fetch só rejeita quando a requisição não chega ao servidor, ou o tempo acaba.
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique a rede e tente de novo.');
  } finally {
    clearTimeout(timer);
  }
}
