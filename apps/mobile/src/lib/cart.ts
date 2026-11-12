// Carrinho do app (em memória; guardar entre aberturas é a Fase 3 da spec 08). Funções puras.
// O total mostrado sai da mesma regra da API (calculateCartSummary, packages/domain); o pedido
// manda só id e quantidade, e o total que vale é o que o servidor devolve.
import { calculateCartSummary } from '../domain.ts';
import type { Product } from '../services/products.ts';
import { formatPrice, slimProduct } from './catalog.ts';

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

export type CartChange = { kind: 'price' | 'stock'; name: string; from: number; to: number } | { kind: 'removed'; name: string };

/**
 * Revalida o carrinho com o catálogo atual antes do pedido (RN05 da spec 08): preço novo entra,
 * produto que saiu do catálogo (ou ficou sem estoque) sai, quantidade acima do estoque conhecido é
 * limitada. O servidor recalcula o preço no pedido, mas não confere estoque: por isso o limite é aqui.
 */
export function revalidateCart(lines: CartLine[], live: Product[]): { lines: CartLine[]; changes: CartChange[] } {
  const byId = new Map(live.map((product) => [product.id, product]));
  const changes: CartChange[] = [];
  const next: CartLine[] = [];
  for (const line of lines) {
    const current = byId.get(line.product.id);
    if (!current || current.stock === 0) {
      changes.push({ kind: 'removed', name: line.product.name });
      continue;
    }
    if (current.price !== line.product.price) {
      changes.push({ kind: 'price', name: current.name, from: line.product.price, to: current.price });
    }
    let quantity = line.quantity;
    if (typeof current.stock === 'number' && quantity > current.stock) {
      changes.push({ kind: 'stock', name: current.name, from: quantity, to: current.stock });
      quantity = current.stock;
    }
    next.push(changes.length === 0 && current.price === line.product.price ? line : { product: { ...line.product, ...current }, quantity });
  }
  return { lines: changes.length === 0 ? lines : next, changes };
}

/** Carrinho como vai para o armazenamento local: só produto (enxuto) e quantidade (RN06). */
export function serializeCart(lines: CartLine[]): CartLine[] {
  return lines.map((line) => ({ product: slimProduct(line.product as Product), quantity: line.quantity }));
}

/** Texto da mudança para a tela: "Milho: preço de R$ 450,00 para R$ 480,00". */
export function describeChange(change: CartChange): string {
  if (change.kind === 'removed') return `${change.name}: saiu do catálogo e foi tirado do carrinho`;
  if (change.kind === 'price') return `${change.name}: preço de ${formatPrice(change.from)} para ${formatPrice(change.to)}`;
  return `${change.name}: quantidade ajustada de ${change.from} para ${change.to} (estoque)`;
}
