// @ts-check
// Regras de pagamento pelo Mercado Pago (spec 10): comissão da AgroTech e o que o pagamento consultado faz
// com o pedido. Funções puras, sem rede: quem consulta o Mercado Pago é o servidor.

export const PAYMENT_STATUS = Object.freeze({
  AGUARDANDO: 'AGUARDANDO_PAGAMENTO',
  PAGO: 'PAGO',
  CANCELADO: 'CANCELADO',
  ESTORNADO: 'ESTORNADO'
});

/** Texto do pedido na tela (o `status` que a web e o app já mostram) para cada estado do pagamento. */
export const PAYMENT_STATUS_LABEL = Object.freeze({
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PAGO: 'Pedido Confirmado',
  CANCELADO: 'Cancelado',
  ESTORNADO: 'Estornado'
});

export const MAX_FEE_PERCENT = 30;

/**
 * Reais para centavos inteiros (0.1 + 0.2 vira 30, não 30.000000000000004).
 * @param {number} reais
 * @returns {number}
 */
export const toCents = (reais) => Math.round(Number(reais) * 100);

/**
 * Comissão da AgroTech em centavos: percentual de 0 a 30 (até 2 casas), arredondada para baixo e sempre
 * menor que o total, para o vendedor nunca receber zero.
 * @param {number} totalCents total do pedido em centavos
 * @param {number} percent comissão em %
 * @returns {number}
 */
export function marketplaceFeeCents(totalCents, percent) {
  if (!Number.isFinite(percent) || percent < 0 || percent > MAX_FEE_PERCENT) {
    throw new RangeError(`Comissão fora do intervalo de 0 a ${MAX_FEE_PERCENT}%.`);
  }
  if (!Number.isInteger(totalCents) || totalCents < 2) return 0;
  // Em pontos-base (inteiros): 0,29% vira 29, sem o 28,999... do ponto flutuante.
  const basisPoints = Math.round(percent * 100);
  return Math.min(Math.floor((totalCents * basisPoints) / 10000), totalCents - 1);
}

const APPROVED = new Set(['approved']);
const REVERSED = new Set(['refunded', 'charged_back']);
const PENDING = new Set(['pending', 'in_process', 'authorized', 'in_mediation']);

/**
 * Pagamento ainda em andamento (boleto ou Pix esperando, cartão em análise)?
 * @param {string | null | undefined} status status do Mercado Pago
 */
export const isPendingPayment = (status) => PENDING.has(String(status));

/**
 * @typedef {{ id: string, total: number, paymentStatus?: string, payment?: { paymentId?: string | null },
 *   paymentReview?: { paymentId?: string, resolvedAt?: string } }} PayableOrder
 * @typedef {{ id: number | string, status: string, external_reference?: string, transaction_amount?: number,
 *   collector_id?: number | string, date_of_expiration?: string | null }} MercadoPagoPayment
 * @typedef {{ to?: string, review?: string, holdUntil?: string | null, resolveReview?: boolean }} PaymentDecision
 */

/**
 * O que um pagamento consultado no Mercado Pago faz com o pedido. `to` é o estado novo; `review` marca
 * divergência para o ADMIN sem mudar nada; `holdUntil` segura a reserva de estoque (pagamento pendente);
 * `resolveReview`: o pagamento que estava em revisão foi estornado (RF-08), o dinheiro voltou.
 * Recusado não cancela: o comprador pode tentar outro meio até a reserva vencer.
 * @param {PayableOrder} order
 * @param {MercadoPagoPayment} payment
 * @param {number | string} collectorId conta Mercado Pago do vendedor do pedido
 * @returns {PaymentDecision}
 */
export function paymentDecision(order, payment, collectorId) {
  if (refundsReviewedPayment(order, payment)) return { resolveReview: true };
  const mismatch = paymentMismatch(order, payment, collectorId);
  if (mismatch) return { review: mismatch };
  const { AGUARDANDO, PAGO, CANCELADO, ESTORNADO } = PAYMENT_STATUS;
  if (APPROVED.has(payment.status)) {
    if (order.paymentStatus === AGUARDANDO) return { to: PAGO };
    if (order.paymentStatus === CANCELADO) return { review: 'pagamento aprovado depois de o pedido ser cancelado' };
    return {};
  }
  if (REVERSED.has(payment.status)) {
    const samePayment = String(order.payment?.paymentId ?? '') === String(payment.id);
    return order.paymentStatus === PAGO && samePayment ? { to: ESTORNADO } : {};
  }
  if (PENDING.has(payment.status) && order.paymentStatus === AGUARDANDO) {
    return { holdUntil: payment.date_of_expiration ?? null };
  }
  return {};
}

/**
 * O pagamento é o que estava em revisão (ainda aberta) e já voltou ao comprador?
 * @param {PayableOrder} order
 * @param {MercadoPagoPayment} payment
 */
function refundsReviewedPayment(order, payment) {
  const review = order.paymentReview;
  return Boolean(review && !review.resolvedAt && review.paymentId === String(payment.id) && REVERSED.has(payment.status));
}

/**
 * @param {PayableOrder} order
 * @param {MercadoPagoPayment} payment
 * @param {number | string} collectorId
 * @returns {string | null}
 */
function paymentMismatch(order, payment, collectorId) {
  if (payment.external_reference !== order.id) return 'referência do pagamento é de outro pedido';
  if (toCents(payment.transaction_amount ?? NaN) !== toCents(order.total)) return 'valor do pagamento diferente do total';
  if (String(payment.collector_id) !== String(collectorId)) return 'recebedor do pagamento não é o vendedor do pedido';
  return null;
}

/**
 * O pedido conta no extrato e na receita? Pendente e cancelado não; pedido antigo (sem pagamento real)
 * conta como sempre contou.
 * @param {{ paymentStatus?: string }} order
 * @returns {boolean}
 */
export const countsAsSale = (order) =>
  order.paymentStatus !== PAYMENT_STATUS.AGUARDANDO && order.paymentStatus !== PAYMENT_STATUS.CANCELADO;

// --- Pagamento na interface (app e web). Funções puras: quem chama decide o que fazer com o resultado. ---

/** @type {Record<string, string>} */
const METHOD_LABEL = { ticket: 'boleto', pix: 'Pix', bank_transfer: 'Pix', credit_card: 'cartão', debit_card: 'cartão de débito' };

/**
 * Só abre link https do próprio Mercado Pago (o servidor manda o init_point da preferência).
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isSafeCheckoutUrl(url) {
  return /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?(\/|$)/i.test(String(url ?? ''));
}

/**
 * Número do pedido na busca da página (?pedido=AGT-…). Qualquer outro formato é null.
 * @param {string | null | undefined} search
 * @returns {string | null}
 */
export function orderIdFromSearch(search) {
  const match = /(?:^|[?&])pedido=([^&#]*)/.exec(String(search ?? ''));
  return match && /^AGT-[A-Z0-9]{3,40}$/.test(match[1]) ? match[1] : null;
}

/** @param {string | null | undefined} method */
const pendingNote = (method) => `Pagamento em andamento (${METHOD_LABEL[String(method)] ?? 'em análise'}): o pedido confirma sozinho quando o Mercado Pago aprovar.`;

/**
 * Botões do pedido em "Meus pedidos". Pedido simulado ou já resolvido não tem nenhum.
 * @param {{ status?: string, paymentStatus?: string, payment?: { checkoutUrl?: string, mpStatus?: string | null, method?: string | null } }} order
 */
export function orderActions(order) {
  if (order.paymentStatus !== 'AGUARDANDO_PAGAMENTO') return { pay: false, cancel: false, check: false, note: null };
  if (isPendingPayment(order.payment?.mpStatus)) return { pay: false, cancel: false, check: true, note: pendingNote(order.payment?.method) };
  return { pay: isSafeCheckoutUrl(order.payment?.checkoutUrl), cancel: true, check: true, note: null };
}

/**
 * O que mostrar depois de conferir o pagamento no servidor. A verdade é o paymentStatus do servidor.
 * @param {{ id?: string, paymentStatus?: string, payment?: { mpStatus?: string | null, method?: string | null } }} order
 * @returns {{ title: string, body: string }}
 */
export function paymentResultMessage(order) {
  const id = order.id ?? '';
  if (order.paymentStatus === 'PAGO') return { title: 'Pagamento aprovado', body: `Pedido ${id} confirmado.` };
  if (order.paymentStatus === 'CANCELADO') return { title: 'Pedido cancelado', body: `O pedido ${id} foi cancelado e o estoque foi liberado.` };
  if (order.paymentStatus === 'ESTORNADO') return { title: 'Pagamento estornado', body: `O pagamento do pedido ${id} foi devolvido.` };
  if (isPendingPayment(order.payment?.mpStatus)) return { title: 'Pagamento em andamento', body: pendingNote(order.payment?.method) };
  return { title: 'O pagamento não foi concluído', body: `O pedido ${id} continua aguardando. Você pode pagar de novo em Meus pedidos.` };
}

/**
 * Vendedor diferente do que já está no carrinho? Produto sem dono (anúncio antigo) não bloqueia.
 * @param {{ ownerEmail?: string }[]} products itens do carrinho
 * @param {{ ownerEmail?: string }} product o que a pessoa quer adicionar
 * @returns {boolean}
 */
export function sellerConflict(products, product) {
  const seller = products.find((item) => item.ownerEmail)?.ownerEmail;
  return Boolean(seller && product.ownerEmail && seller !== product.ownerEmail);
}

/**
 * Problema do carrinho para pagar pelo Mercado Pago, com os produtos já conferidos no catálogo ao vivo:
 * mais de um vendedor, ou produto de vendedor que ainda não recebe. null = pode pagar.
 * @param {{ name: string, ownerEmail?: string, payable?: boolean }[]} products
 * @returns {string | null}
 */
export function cartSellerProblem(products) {
  const sellers = new Set(products.map((product) => product.ownerEmail).filter(Boolean));
  if (sellers.size > 1) return 'O carrinho tem produtos de mais de um vendedor. Pague um vendedor por vez: remova os de outro vendedor.';
  const blocked = products.filter((product) => product.payable === false).map((product) => product.name);
  if (blocked.length) return `O vendedor de ${blocked.join(', ')} ainda não recebe pelo Mercado Pago. Remova do carrinho para pagar o resto.`;
  return null;
}
