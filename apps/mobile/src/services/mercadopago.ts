// Conta Mercado Pago do vendedor (spec 10, RF-01): situação, começar a conexão (o servidor devolve o link
// de autorização oficial, aberto no navegador) e desconectar. Nenhum token passa pelo app.
import { apiRequest } from './api.ts';

export type MpStatus = { connected: boolean; expiresAt: string | null };

export function loadMpStatus(): Promise<MpStatus> {
  return apiRequest<MpStatus>('/mp/status');
}

/** Link de autorização do Mercado Pago (vale 10 minutos e uma vez). */
export async function startMpConnection(): Promise<string> {
  return (await apiRequest<{ url: string }>('/mp/connect', { method: 'POST' })).url;
}

export function disconnectMp(): Promise<void> {
  return apiRequest<void>('/mp/connect', { method: 'DELETE' });
}
