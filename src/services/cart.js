// @ts-check

/** @typedef {{ id: string, quantity?: number | string, [key: string]: unknown }} CartItem */

/**
 * @param {CartItem[]} [cart]
 * @param {CartItem | null} [product]
 * @returns {CartItem[]}
 */
export function addProductToCart(cart = [], product = null) {
  if (!product) return cart;

  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    return cart.map(item => item.id === product.id
      ? { ...item, quantity: Number(item.quantity || 0) + 1 }
      : item);
  }

  return [...cart, { ...product, quantity: 1 }];
}

/**
 * @param {CartItem[]} cart
 * @param {string} productId
 * @returns {CartItem[]}
 */
export function removeProductFromCart(cart = [], productId) {
  return cart.filter(item => item.id !== productId);
}

/**
 * Remove o item quando a quantidade chega a zero.
 * @param {CartItem[]} cart
 * @param {string} productId
 * @param {number} [delta]
 */
export function updateCartItemQuantity(cart = [], productId, delta = 0) {
  return cart
    .map(item => {
      if (item.id === productId) {
        const nextQty = Number(item.quantity || 0) + delta;
        return nextQty > 0 ? { ...item, quantity: nextQty } : null;
      }
      return item;
    })
    .filter(Boolean);
}

