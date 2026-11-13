// Pagamento pelo Mercado Pago no app (spec 10, parte 3). Funções puras: carrinho de um vendedor, link de
// volta, link de pagamento e botões de cada pedido. A palavra final sobre o pagamento é sempre do
// servidor (POST /api/orders/{id}/sync); o app nunca decide "aprovado" pelo link de volta.
import type { CartLine } from './cart.ts';
import type { Product } from '../services/products.ts';

export type PaymentInfo = { checkoutUrl?: string; mpStatus?: string | null; method?: string | null };
export type PayableOrderView = { id?: string; status?: string; paymentStatus?: string; payment?: PaymentInfo };

const PENDING = new Set(['pending', 'in_process', 'authorized', 'in_mediation']);
const METHOD_LABEL: Record<string, string> = { ticket: 'boleto', pix: 'Pix', bank_transfer: 'Pix', credit_card: 'cartão', debit_card: 'cartão de débito' };

const sellerOf = (lines: CartLine[]): string | undefined => lines.find((line) => line.product.ownerEmail)?.product.ownerEmail;

/** O produto é de outro vendedor que o do carrinho? Carrinho antigo, sem o dono salvo, não bloqueia aqui. */
export function sellerConflict(lines: CartLine[], product: Pick<Product, 'ownerEmail'>): boolean {
  const seller = sellerOf(lines);
  return Boolean(seller && product.ownerEmail && seller !== product.ownerEmail);
}

/**
 * Problema do carrinho para pagar pelo Mercado Pago, pelo catálogo ao vivo (o carrinho salvo pode não ter
 * o dono do anúncio): mais de um vendedor, ou produto de vendedor que ainda não recebe. null = pode pagar.
 */
export function cartSellerProblem(lines: CartLine[], live: Product[]): string | null {
  const byId = new Map(live.map((product) => [product.id, product]));
  const current = lines.map((line) => byId.get(line.product.id) ?? (line.product as Product));
  const sellers = new Set(current.map((product) => product.ownerEmail).filter(Boolean));
  if (sellers.size > 1) return 'O carrinho tem produtos de mais de um vendedor. Pague um vendedor por vez: remova os de outro vendedor.';
  const blocked = current.filter((product) => product.payable === false).map((product) => product.name);
  if (blocked.length) return `O vendedor de ${blocked.join(', ')} ainda não recebe pelo Mercado Pago. Remova do carrinho para pagar o resto.`;
  return null;
}

/** Número do pedido do link de volta do Checkout Pro (agrotech://pagamento/retorno?pedido=AGT-…), ou null. */
export function parseReturnLink(url: string | null | undefined): string | null {
  const match = /^agrotech:\/\/pagamento\/retorno\?(?:[^#]*&)?pedido=(AGT-[A-Z0-9]{3,40})(?:&|#|$)/.exec(String(url ?? ''));
  return match ? match[1] : null;
}

/** Só abre link https do próprio Mercado Pago (o servidor manda o init_point da preferência). */
export function isSafeCheckoutUrl(url: string | null | undefined): boolean {
  return /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?(\/|$)/i.test(String(url ?? ''));
}

const pendingNote = (method: string | null | undefined): string =>
  `Pagamento em andamento (${METHOD_LABEL[String(method)] ?? 'em análise'}): o pedido confirma sozinho quando o Mercado Pago aprovar.`;

/** Botões do pedido em "Meus pedidos". Pedido simulado ou já resolvido não tem nenhum. */
export function orderActions(order: PayableOrderView): { pay: boolean; cancel: boolean; check: boolean; note: string | null } {
  if (order.paymentStatus !== 'AGUARDANDO_PAGAMENTO') return { pay: false, cancel: false, check: false, note: null };
  if (PENDING.has(String(order.payment?.mpStatus))) return { pay: false, cancel: false, check: true, note: pendingNote(order.payment?.method) };
  return { pay: isSafeCheckoutUrl(order.payment?.checkoutUrl), cancel: true, check: true, note: null };
}

/** O que mostrar depois de conferir o pagamento no servidor. */
export function paymentResultMessage(order: PayableOrderView): { title: string; body: string } {
  const id = order.id ?? '';
  if (order.paymentStatus === 'PAGO') return { title: 'Pagamento aprovado', body: `Pedido ${id} confirmado.` };
  if (order.paymentStatus === 'CANCELADO') return { title: 'Pedido cancelado', body: `O pedido ${id} foi cancelado e o estoque foi liberado.` };
  if (order.paymentStatus === 'ESTORNADO') return { title: 'Pagamento estornado', body: `O pagamento do pedido ${id} foi devolvido.` };
  if (PENDING.has(String(order.payment?.mpStatus))) return { title: 'Pagamento em andamento', body: pendingNote(order.payment?.method) };
  return { title: 'O pagamento não foi concluído', body: `O pedido ${id} continua aguardando. Você pode pagar de novo em Meus pedidos.` };
}

/** Rótulo da origem do lançamento no extrato. */
export function entrySourceLabel(source: string): string {
  return ({ COMPRA: 'Compra', VENDA: 'Venda', ESTORNO: 'Estorno', MANUAL: 'Manual' } as Record<string, string>)[source] ?? source;
}
