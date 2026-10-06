const STORAGE_KEYS = {
  USER: 'agrotech_user',
  PRODUCTS: 'agrotech_products',
  TOKEN: 'agrotech_token'
};

export function readStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

export function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getUser() {
  return readStorage(STORAGE_KEYS.USER, null);
}

export function setUser(user) {
  writeStorage(STORAGE_KEYS.USER, user);
}

export function removeUser() {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

export function getProducts() {
  return readStorage(STORAGE_KEYS.PRODUCTS, null);
}

export function setProducts(products) {
  writeStorage(STORAGE_KEYS.PRODUCTS, products);
}

export function getToken() {
  return readStorage(STORAGE_KEYS.TOKEN, null);
}

export function setToken(token) {
  writeStorage(STORAGE_KEYS.TOKEN, token);
}

export function removeToken() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}
