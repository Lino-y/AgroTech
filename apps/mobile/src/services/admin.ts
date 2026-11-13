// Ações do ADMIN (spec 05): listar usuários e gerar o código de redefinição de senha de um deles.
// O código é repassado à pessoa por fora (telefone, WhatsApp): não há envio por e-mail.
import { apiRequest } from './api.ts';

export type AdminUser = { id: string; name: string; email: string; role: string; propertyOrCompany?: string };

export function loadUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>('/admin/users');
}

export function createResetCode(userId: string): Promise<{ code: string; expiresAt: string }> {
  return apiRequest(`/admin/users/${encodeURIComponent(userId)}/reset-code`, { method: 'POST' });
}

// --- Mercado Pago (spec 10): comissão e estorno, só ADMIN ---

export function loadFeeSettings(): Promise<{ marketplaceFeePercent: number }> {
  return apiRequest('/admin/settings');
}

export function saveFeeSettings(marketplaceFeePercent: number): Promise<{ marketplaceFeePercent: number }> {
  return apiRequest('/admin/settings', { method: 'PUT', body: { marketplaceFeePercent } });
}

/** Estorno total no Mercado Pago (202): o pedido muda quando ele confirmar. */
export function refundOrder(orderId: string): Promise<{ message: string }> {
  return apiRequest(`/admin/orders/${encodeURIComponent(orderId)}/refund`, { method: 'POST' });
}
