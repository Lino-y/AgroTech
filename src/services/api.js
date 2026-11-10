import { getToken, removeToken, removeUser } from './storage.js';

// A tela registra o que fazer quando a sessão deixa de valer (volta ao login e limpa o estado da conta).
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Sem limite de tempo, um servidor que não responde deixava o "carregando" ligado para sempre.
const REQUEST_TIMEOUT_MS = 30_000;

export async function apiRequest(path, options = {}) {
  const token = getToken();
  // Os cabeçalhos do chamador somam aos montados aqui; não podem apagar o token (issue #22).
  const { headers = {}, ...rest } = options;
  const response = await fetch(`/api${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  }).catch((error) => {
    if (error?.name === 'TimeoutError') {
      throw new Error('O servidor demorou para responder. Tente de novo.', { cause: error });
    }
    // O fetch só rejeita quando a requisição não chega ao servidor (sem internet, servidor fora do ar).
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.', { cause: error });
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.message || 'Erro ao carregar dados do servidor.';

    // 401 de quem estava logado: a sessão deixou de valer. O 403 é regra de negócio (ex.: excluir o
    // anúncio de outro) e não encerra nada.
    if (response.status === 401 && token) {
      removeToken();
      removeUser();
      onUnauthorized?.();
    }

    throw Object.assign(new Error(message), { status: response.status });
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

export async function loadFinanceEntries() {
  return apiRequest('/finance/entries');
}

export async function createFinanceEntry(payload) {
  return apiRequest('/finance/entries', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateStore(payload) {
  return apiRequest('/auth/store', { method: 'PUT', body: JSON.stringify(payload) });
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
