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
