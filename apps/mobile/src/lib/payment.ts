// Pagamento pelo Mercado Pago no app (spec 10, partes 3 e 3b). As regras compartilhadas com a web vêm de
// packages/domain/payments.js (pela ponte src/domain.ts); aqui ficam só as partes que só o app usa e a
// adaptação do carrinho. A palavra final sobre o pagamento é sempre do servidor (POST /api/orders/{id}/sync).
import type { CartLine } from './cart.ts';
import type { Product } from '../services/products.ts';
import {
  cartSellerProblem as domainCartSellerProblem,
  isSafeCheckoutUrl,
  orderActions,
  paymentResultMessage,
  sellerConflict as domainSellerConflict
} from '../domain.ts';

export { isSafeCheckoutUrl, orderActions, paymentResultMessage };

export type PaymentInfo = { checkoutUrl?: string; mpStatus?: string | null; method?: string | null };
export type PayableOrderView = { id?: string; status?: string; paymentStatus?: string; payment?: PaymentInfo };

/** O produto é de outro vendedor que o do carrinho? Carrinho antigo, sem o dono salvo, não bloqueia aqui. */
export function sellerConflict(lines: CartLine[], product: Pick<Product, 'ownerEmail'>): boolean {
  return domainSellerConflict(lines.map((line) => line.product), product);
}

/**
 * Problema do carrinho para pagar, pelo catálogo ao vivo (o carrinho salvo pode não ter o dono do anúncio).
 * A regra vive no domínio; aqui só se junta a linha do carrinho com o produto atual do catálogo.
 */
export function cartSellerProblem(lines: CartLine[], live: Product[]): string | null {
  const byId = new Map(live.map((product) => [product.id, product]));
  return domainCartSellerProblem(lines.map((line) => byId.get(line.product.id) ?? (line.product as Product)));
}

/** Número do pedido do link de volta do Checkout Pro (agrotech://pagamento/retorno?pedido=AGT-…), ou null. */
export function parseReturnLink(url: string | null | undefined): string | null {
  const match = /^agrotech:\/\/pagamento\/retorno\?(?:[^#]*&)?pedido=(AGT-[A-Z0-9]{3,40})(?:&|#|$)/.exec(String(url ?? ''));
  return match ? match[1] : null;
}

/** Rótulo da origem do lançamento no extrato. */
export function entrySourceLabel(source: string): string {
  return ({ COMPRA: 'Compra', VENDA: 'Venda', ESTORNO: 'Estorno', MANUAL: 'Manual' } as Record<string, string>)[source] ?? source;
}

// --- parte 3b: vendedor e master ---

/** Só abre o link de autorização oficial (o servidor devolve auth.mercadopago.com/authorization?...). */
export function isSafeAuthorizationUrl(url: string | null | undefined): boolean {
  return /^https:\/\/auth\.mercadopago\.com(\.br)?\/authorization(\?|$)/i.test(String(url ?? ''));
}

/** Comissão digitada pelo master: aceita vírgula; de 0 a 30, até 2 casas. null = inválida. */
export function parseFeePercent(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value >= 0 && value <= 30 ? value : null;
}

export type RefundableOrder = PayableOrderView & {
  id: string;
  total?: number;
  payment?: PaymentInfo & { paymentId?: string | null };
  paymentReview?: { reason: string; paymentId: string; resolvedAt?: string };
};

/**
 * O que o master pode estornar (RF-08): pagamento em revisão aberta (dinheiro com o vendedor sem pedido
 * pago) primeiro, depois os pedidos pagos.
 */
export function refundCandidates<T extends RefundableOrder>(orders: T[]): { order: T; kind: 'revisao' | 'pago' }[] {
  const review = orders.filter((order) => order.paymentReview && !order.paymentReview.resolvedAt && order.paymentStatus !== 'PAGO');
  const paid = orders.filter((order) => order.paymentStatus === 'PAGO');
  return [...review.map((order) => ({ order, kind: 'revisao' as const })), ...paid.map((order) => ({ order, kind: 'pago' as const }))];
}
