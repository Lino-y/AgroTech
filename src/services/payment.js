// @ts-check
/**
 * Estados de pagamento (RF04, issue #5).
 *
 * O pagamento é uma máquina de estados: o pedido do cliente nunca "nasce
 * aprovado". Ele nasce PENDENTE e só avança por transições válidas —
 * uma confirmação visual na tela não é pagamento realizado.
 *
 * @typedef {'pix'|'credit'|'boleto'} PaymentMethod
 * @typedef {'PENDENTE'|'APROVADO'|'RECUSADO'|'EXPIRADO'} PaymentStatus
 *
 * Transições válidas:
 *   PENDENTE  -> APROVADO  (confirmação do meio: Pix pago, cartão aprovado, boleto liquidado)
 *   PENDENTE  -> RECUSADO  (cartão recusado)
 *   PENDENTE  -> EXPIRADO  (Pix/boleto vencidos sem pagamento)
 *   RECUSADO  -> PENDENTE  (nova tentativa do mesmo pagamento)
 * Qualquer outra transição é recusada (ex.: APROVADO -> RECUSADO).
 */

/** @type {Record<PaymentMethod, { label: string, installments: [number, number] | null }>} */
export const PAYMENT_METHODS = {
  pix: { label: 'Pix (Aprovação Imediata)', installments: null },
  credit: { label: 'Cartão de Crédito', installments: [1, 6] },
  boleto: { label: 'Boleto Bancário', installments: null }
};

/** @type {Record<PaymentStatus, PaymentStatus[]>} */
const TRANSITIONS = {
  PENDENTE: ['APROVADO', 'RECUSADO', 'EXPIRADO'],
  RECUSADO: ['PENDENTE'],
  APROVADO: [],
  EXPIRADO: []
};

/**
 * True se a transição de status é válida para este pagamento.
 * @param {PaymentStatus} from
 * @param {PaymentStatus} to
 */
export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/**
 * @param {string} method
 * @returns {method is PaymentMethod}
 */
function isKnownMethod(method) {
  return Boolean(PAYMENT_METHODS[/** @type {PaymentMethod} */ (method)]);
}

/**
 * Valida o corpo de criação do pagamento. Não aceita nem registra nenhum
 * dado sensível de cartão (número, CVV, validade) — só metadados.
 * @param {{ method?: string, installments?: unknown } | null | undefined} body
 * @returns {{ valid: true, method: PaymentMethod, installments: number }
 *   | { valid: false, message: string }}
 */
export function validatePaymentRequest(body) {
  const rawMethod = String(body?.method ?? '');
  if (!isKnownMethod(rawMethod)) {
    return { valid: false, message: 'Meio de pagamento inválido: use pix, credit ou boleto.' };
  }
  const method = rawMethod;

  const installments = Number(body?.installments ?? 1);
  if (!Number.isInteger(installments)) {
    return { valid: false, message: 'Parcelas devem ser um número inteiro.' };
  }

  const range = PAYMENT_METHODS[method].installments;
  if (range && (installments < range[0] || installments > range[1])) {
    return { valid: false, message: `Cartão aceita de ${range[0]} a ${range[1]} parcelas.` };
  }
  if (!range && installments !== 1) {
    return { valid: false, message: `Pagamento por ${PAYMENT_METHODS[method].label} não é parcelado.` };
  }

  return { valid: true, method, installments: range ? installments : 1 };
}
