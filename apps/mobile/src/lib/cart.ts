// Carrinho do app (em memória; guardar entre aberturas é a Fase 3 da spec 08). Funções puras.
// O total mostrado sai da mesma regra da API (calculateCartSummary, packages/domain); o pedido
// manda só id e quantidade, e o total que vale é o que o servidor devolve.
import { calculateCartSummary } from '../domain.ts';
import type { Product } from '../services/products.ts';

/** Igual a MAX_ORDER_QUANTITY de apps/api/server.js: acima disso o servidor recusa o pedido. */
export const MAX_ORDER_QUANTITY = 10_000;

export type CartLine = { product: Pick<Product, 'id' | 'name' | 'price'> & Partial<Product>; quantity: number };

const clamp = (quantity: number): number => Math.min(MAX_ORDER_QUANTITY, Math.max(0, Math.floor(quantity)));

export function addToCart(lines: CartLine[], product: CartLine['product'], quantity = 1): CartLine[] {
  const existing = lines.find((line) => line.product.id === product.id);
  if (!existing) return [...lines, { product, quantity: Math.max(1, clamp(quantity)) }];
  return lines.map((line) => (line === existing ? { ...line, quantity: clamp(line.quantity + quantity) } : line));
}

/** Quantidade 0 (ou menos) tira a linha. */
export function setQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  const next = clamp(quantity);
  if (next === 0) return removeFromCart(lines, productId);
  return lines.map((line) => (line.product.id === productId ? { ...line, quantity: next } : line));
}

export function removeFromCart(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((line) => line.product.id !== productId);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function toOrderItems(lines: CartLine[]): { id: string; quantity: number }[] {
  return lines.map((line) => ({ id: line.product.id, quantity: line.quantity }));
}

export function cartSummary(lines: CartLine[], coupon: string | null) {
  return calculateCartSummary(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity })),
    coupon
  );
}
