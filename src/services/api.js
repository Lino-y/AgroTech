import { getToken, removeToken, removeUser } from './storage.js';

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
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

// RF04: pagamento nasce PENDENTE; confirmação explícita separada.
export async function createPayment(payload) {
  return apiRequest('/payments', { method: 'POST', body: JSON.stringify(payload) });
}

export async function confirmPayment(id) {
  return apiRequest(`/payments/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
}

export async function loadOrders() {
  return apiRequest('/orders');
}

export async function updateStore(payload) {
  return apiRequest('/auth/store', { method: 'PUT', body: JSON.stringify(payload) });
}

// Perfil público de uma loja (capa, foto, bio, contato) por e-mail do vendedor
export async function loadSellerStore(email) {
  return apiRequest(`/store/${encodeURIComponent(email)}`);
}

export async function deleteProduct(id) {
  return apiRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addReview(productId, payload) {
  return apiRequest(`/products/${encodeURIComponent(productId)}/reviews`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function deleteReview(productId, reviewId) {
  return apiRequest(`/products/${encodeURIComponent(productId)}/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE' });
}
