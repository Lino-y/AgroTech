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
 * @typedef {{ id: string, total: number, paymentStatus?: string, payment?: { paymentId?: string | null } }} PayableOrder
 * @typedef {{ id: number | string, status: string, external_reference?: string, transaction_amount?: number,
 *   collector_id?: number | string, date_of_expiration?: string | null }} MercadoPagoPayment
 * @typedef {{ to?: string, review?: string, holdUntil?: string | null }} PaymentDecision
 */

/**
 * O que um pagamento consultado no Mercado Pago faz com o pedido. `to` é o estado novo; `review` marca
 * divergência para o ADMIN sem mudar nada; `holdUntil` segura a reserva de estoque (pagamento pendente).
 * Recusado não cancela: o comprador pode tentar outro meio até a reserva vencer.
 * @param {PayableOrder} order
 * @param {MercadoPagoPayment} payment
 * @param {number | string} collectorId conta Mercado Pago do vendedor do pedido
 * @returns {PaymentDecision}
 */
export function paymentDecision(order, payment, collectorId) {
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
