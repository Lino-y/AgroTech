import { normalizeUser, validateEmail } from '../services/commerce.js';
import { getUser, setUser } from '../services/storage.js';

export class AuthService {
  constructor() {
    this.currentUser = getUser();
  }

  register({ name, email, password, role = 'PRODUTOR', propertyOrCompany = '' }) {
    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPassword = String(password || '');

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      throw new Error('Nome, e-mail e senha são obrigatórios.');
    }

    if (!validateEmail(trimmedEmail)) {
      throw new Error('Informe um e-mail válido.');
    }

    const user = normalizeUser({
      name: trimmedName,
      email: trimmedEmail,
      password: trimmedPassword,
      role,
      propertyOrCompany
    });

    this.currentUser = user;
    setUser(user);
    return user;
  }

  login(email, password) {
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPassword = String(password || '');

    if (!trimmedEmail || !trimmedPassword) {
      throw new Error('E-mail e senha são obrigatórios.');
    }

    const registered = getUser();
    if (registered && registered.email === trimmedEmail && String(registered.password || '') === trimmedPassword) {
      this.currentUser = registered;
      return this.currentUser;
    }

    throw new Error('E-mail ou senha incorretos.');
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('agrotech_user');
  }
}