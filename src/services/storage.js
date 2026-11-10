const STORAGE_KEYS = {
  USER: 'agrotech_user',
  PRODUCTS: 'agrotech_products',
  TOKEN: 'agrotech_token'
};

export function readStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Armazenamento cheio ou bloqueado não pode derrubar o fluxo: o servidor já gravou, e o cache local é só
// conveniência. Devolve false quando não coube.
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // armazenamento indisponível: não há o que remover
  }
}

export function getUser() {
  return readStorage(STORAGE_KEYS.USER, null);
}

export function setUser(user) {
  writeStorage(STORAGE_KEYS.USER, user);
}

export function removeUser() {
  removeStorage(STORAGE_KEYS.USER);
}

export function getProducts() {
  const cached = readStorage(STORAGE_KEYS.PRODUCTS, null);
  // Cache corrompido ({} no lugar da lista) quebrava a inicialização da tela.
  return Array.isArray(cached) ? cached : null;
}

export function setProducts(products) {
  // Se não coube, o cache velho sai: ele ocuparia o espaço de que o token e o usuário vão precisar.
  if (!writeStorage(STORAGE_KEYS.PRODUCTS, products)) removeStorage(STORAGE_KEYS.PRODUCTS);
}

export function getToken() {
  return readStorage(STORAGE_KEYS.TOKEN, null);
}

export function setToken(token) {
  writeStorage(STORAGE_KEYS.TOKEN, token);
}

export function removeToken() {
  removeStorage(STORAGE_KEYS.TOKEN);
}
