// Regras de formulário do cadastro. Funções puras: o servidor valida tudo de novo (apps/api/server.js).

export type SignupRole = 'PRODUTOR' | 'VENDEDOR';

// Os mesmos perfis e rótulos do cadastro da web. ADMIN nunca é aceito pelo servidor.
export const SIGNUP_ROLES: { value: SignupRole; label: string }[] = [
  { value: 'PRODUTOR', label: 'Comprador Rural (Produtor)' },
  { value: 'VENDEDOR', label: 'Vendedor / Fornecedor Agro' }
];

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Primeira mensagem de erro do cadastro, ou null quando está tudo preenchido. */
export function validateRegister(form: { name: string; email: string; password: string }): string | null {
  if (!form.name.trim()) return 'Informe seu nome.';
  if (!isValidEmail(form.email)) return 'Informe um e-mail válido.';
  if (!form.password) return 'Informe uma senha.';
  return null;
}
