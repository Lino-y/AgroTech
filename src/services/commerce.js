// @ts-check

/**
 * @typedef {{ type: 'percent' | 'fixed', value: number, min: number, description: string }
 *   | { type: 'free_shipping', min: number, description: string }} CouponRule
 * @typedef {{ price?: number | string, quantity?: number | string }} CartLine
 * @typedef {{ subtotal: number, discount: number, shipping: number, total: number,
 *   freeShipping: boolean, hasCoupon: boolean }} CartSummary
 */

/** @type {Record<string, CouponRule>} */
export const COUPON_RULES = {
  AGRO10: { type: 'percent', value: 0.10, min: 150, description: '10% OFF acima de R$ 150' },
  FRETEGRATIS: { type: 'free_shipping', min: 400, description: 'Frete Grátis acima de R$ 400' },
  NOVOCLIENTE: { type: 'fixed', value: 25, min: 100, description: 'R$ 25 OFF acima de R$ 100' },
  COLHEITA20: { type: 'percent', value: 0.20, min: 800, description: '20% OFF acima de R$ 800' }
};

/**
 * @param {unknown} code
 * @param {number} [subtotal]
 */
export function validateCouponCode(code, subtotal = 0) {
  const upper = String(code || '').trim().toUpperCase();
  if (!upper) {
    return { valid: false, message: 'Informe o código do cupom.' };
  }
  const rule = COUPON_RULES[upper];
  if (!rule) {
    return { valid: false, message: 'Cupom inválido. Utilize AGRO10, FRETEGRATIS, NOVOCLIENTE ou COLHEITA20.' };
  }
  if (subtotal < rule.min) {
    return {
      valid: false,
      message: `Cupom ${upper} exige valor mínimo de R$ ${rule.min.toFixed(2)}. Subtotal: R$ ${subtotal.toFixed(2)}.`
    };
  }
  return { valid: true, coupon: upper, rule };
}


/**
 * @param {CartLine[]} [cart]
 * @param {string | null} [appliedCoupon]
 * @returns {CartSummary}
 */
export function calculateCartSummary(cart = [], appliedCoupon = null) {
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  let discount = 0;
  let freeShipping = subtotal > 800; // RF03: frete grátis acima de R$ 800,00

  if (appliedCoupon && COUPON_RULES[appliedCoupon]) {
    const rule = COUPON_RULES[appliedCoupon];
    if (subtotal >= (rule.min || 0)) {
      if (rule.type === 'percent') {
        discount = subtotal * rule.value;
      }
      if (rule.type === 'fixed') {
        discount = rule.value;
      }
      if (rule.type === 'free_shipping') {
        freeShipping = true;
      }
    }
  }

  const shipping = freeShipping || subtotal === 0 ? 0 : 35;
  const total = Math.max(0, subtotal - discount) + shipping;

  return {
    subtotal,
    discount,
    shipping,
    total,
    freeShipping,
    hasCoupon: Boolean(appliedCoupon)
  };
}

/**
 * @param {unknown} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * @param {{ id?: string, name?: string, propertyOrCompany?: string, email?: string,
 *   password?: string, role?: string }} [payload]
 */
export function normalizeUser(payload = {}) {
  return {
    id: payload.id || `usr-${Date.now()}`,
    name: String(payload.name || '').trim(),
    propertyOrCompany: String(payload.propertyOrCompany || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    password: String(payload.password || ''),
    role: payload.role || 'PRODUTOR'
  };
}
