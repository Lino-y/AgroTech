import { COUPON_RULES, calculateCartSummary } from '../services/commerce.js';

export class CartEngine {
  constructor(initialCart = []) {
    this.cart = [...initialCart];
    this.coupons = { ...COUPON_RULES };
    this.appliedCoupon = null;
  }

  addItem(product, quantity = 1) {
    if (!product) return this.cart;
    const existing = this.cart.find(item => item.id === product.id);
    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + quantity;
    } else {
      this.cart.push({ ...product, quantity: Math.max(1, quantity) });
    }
    return this.cart;
  }

  removeItem(productId) {
    this.cart = this.cart.filter(item => item.id !== productId);
    return this.cart;
  }

  updateQuantity(productId, delta) {
    const existing = this.cart.find(item => item.id === productId);
    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + delta;
      if (existing.quantity <= 0) {
        this.removeItem(productId);
      }
    }
    return this.cart;
  }

  validateCoupon(code) {
    const upper = String(code || '').trim().toUpperCase();
    if (!upper) return { valid: false, message: 'Digite um cupom.' };
    const rule = this.coupons[upper];
    if (!rule) return { valid: false, message: 'Cupom inválido.' };

    const subtotal = this.cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    if (subtotal < rule.min) {
      return { valid: false, message: `Válido em compras a partir de R$ ${rule.min.toFixed(2)}. Subtotal atual: R$ ${subtotal.toFixed(2)}.` };
    }
    return { valid: true, coupon: upper, rule };
  }

  applyCoupon(code) {
    const validation = this.validateCoupon(code);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    this.appliedCoupon = validation.coupon;
    return this.calculateTotals();
  }

  removeCoupon() {
    this.appliedCoupon = null;
    return this.calculateTotals();
  }

  calculateTotals() {
    // Fonte única de verdade (issue #43): a mesma regra da tela, inclusive centavos exatos e o
    // aviso de frete grátis por compra. O cupom só aparece como aplicado quando fez efeito.
    const summary = calculateCartSummary(this.cart, this.appliedCoupon);
    const madeDifference = summary.discount > 0 || (this.appliedCoupon === 'FRETEGRATIS' && !summary.freeShippingBySubtotal);
    return { ...summary, appliedCoupon: madeDifference ? this.appliedCoupon : null };
  }
}
