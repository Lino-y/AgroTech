// Login, cadastro e logout do app. O servidor já encerra as sessões (POST /api/auth/logout, spec 05); aqui a
// sessão local some mesmo que a rede falhe, para o aparelho nunca ficar preso logado.
import { apiRequest } from './api.ts';
import type { SignupRole } from '../lib/forms.ts';
import { clearSession, setSession } from './storage.ts';

export type User = { id: string; name: string; email: string; role: string; propertyOrCompany?: string };

export async function login(email: string, password: string): Promise<User> {
  const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  await setSession({ token: res.token, user: res.user as unknown as Record<string, unknown> });
  return res.user;
}

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: SignupRole;
  propertyOrCompany: string;
};

/** Cria a conta (POST /api/auth/register, spec 05) e já abre a sessão, como o login. */
export async function register(input: RegisterInput): Promise<User> {
  const res = await apiRequest<{ token: string; user: User }>('/auth/register', { method: 'POST', body: input });
  await setSession({ token: res.token, user: res.user as unknown as Record<string, unknown> });
  return res.user;
}

/** Troca a senha com o código que o ADMIN gerou (POST /api/auth/reset-password, spec 05). */
export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  await apiRequest<void>('/auth/reset-password', { method: 'POST', body: { email, code, password } });
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
  } catch {
    // Sem rede o servidor não recebe o aviso, mas sair do app não depende dele.
  } finally {
    await clearSession();
  }
}
