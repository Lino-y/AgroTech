// Pedidos (POST e GET /api/orders, spec 05). O servidor calcula preço e total pelo catálogo; o app
// manda só id e quantidade e mostra o total que voltou.
import { apiRequest } from './api.ts';

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  imageEmoji?: string;
  imageBg?: string;
};

export type Order = {
  id: string;
  createdAt?: string;
  status: string;
  total: number;
  items: OrderItem[];
  trackingCode?: string;
  carrier?: string;
  estimatedDelivery?: string;
  /** Etapas da entrega (Pedido Confirmado, Separação, Saiu para Entrega, Chegada na Fazenda). */
  timeline?: { title: string; time: string; completed: boolean }[];
  /** Só em pedido pago pelo Mercado Pago (spec 10): AGUARDANDO_PAGAMENTO, PAGO, CANCELADO ou ESTORNADO. */
  paymentStatus?: string;
  reservedUntil?: string;
  payment?: { checkoutUrl?: string; mpStatus?: string | null; method?: string | null; paymentId?: string | null };
  /** Pagamento divergente ou aprovado depois do cancelamento, que o master pode estornar. */
  paymentReview?: { reason: string; paymentId: string; resolvedAt?: string };
  ownerEmail?: string;
  sellerEmail?: string;
};

/**
 * A mesma chave nas novas tentativas do mesmo envio (toque duplo, rede caiu): o servidor devolve o
 * pedido já criado em vez de criar outro. Trocar a chave quando o carrinho ou o cupom mudar.
 * Com o Mercado Pago ligado, `returnTo: 'app'` faz o Checkout Pro voltar para o app.
 */
export function placeOrder(
  items: { id: string; quantity: number }[],
  coupon: string | null,
  idempotencyKey: string,
  returnTo?: 'app'
): Promise<Order> {
  return apiRequest<Order>('/orders', {
    method: 'POST',
    body: returnTo ? { items, coupon, returnTo } : { items, coupon },
    headers: { 'Idempotency-Key': idempotencyKey }
  });
}

/** Confere o pagamento no Mercado Pago pelo servidor (volta do Checkout Pro). */
export function syncOrderPayment(orderId: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${encodeURIComponent(orderId)}/sync`, { method: 'POST' });
}

/** Desiste do pedido aguardando pagamento: o estoque volta e a página de pagamento vence. */
export function cancelOrderPayment(orderId: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
}

export function loadOrders(): Promise<Order[]> {
  return apiRequest<Order[]>('/orders');
}

// ponytail: Math.random, não crypto (o Hermes não garante crypto.randomUUID). Não é segredo: o
// servidor só usa a chave para reconhecer reenvio do mesmo usuário (8 a 64 de [A-Za-z0-9_-]).
export function newIdempotencyKey(): string {
  return `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
