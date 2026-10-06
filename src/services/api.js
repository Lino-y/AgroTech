import { getToken, removeToken, removeUser } from './storage.js';

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.message || 'Erro ao carregar dados do servidor.';

    if (response.status === 401 || response.status === 403) {
      removeToken();
      removeUser();
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function loadProducts() {
  return apiRequest('/products');
}

export async function registerUser(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export async function loginUser(payload) {
  return apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createProduct(payload) {
  return apiRequest('/products', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createOrder(payload) {
  return apiRequest('/orders', { method: 'POST', body: JSON.stringify(payload) });
}

export async function loadOrders() {
  return apiRequest('/orders');
}
