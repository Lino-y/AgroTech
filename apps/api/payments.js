// Fluxos de pagamento do pedido pelo Mercado Pago (spec 10, parte 1). Operam sobre o objeto do banco já
// lido (readDb) e devolvem se algo mudou; quem grava (writeDb) é o server.js, dentro da fila de escrita.
// As regras puras (comissão, o que cada status faz) estão em packages/domain/payments.js.
import crypto from 'node:crypto';
import {
  marketplaceFeeCents, paymentDecision, PAYMENT_STATUS, PAYMENT_STATUS_LABEL, toCents
} from '../../packages/domain/payments.js';
import {
  authorizationUrl, createPreference, decryptToken, encryptToken, exchangeCode, getPayment, pkcePair,
  refreshAccessToken, searchPayments
} from './mercadopago.js';

const { AGUARDANDO, PAGO, CANCELADO, ESTORNADO } = PAYMENT_STATUS;
const REFRESH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
// Pedido pendente há mais que isto é reconsultado na varredura: recupera webhook perdido.
const SYNC_PENDING_AFTER_MS = 2 * 60 * 1000;
const SELLER_ROLES = new Set(['VENDEDOR', 'AMBOS']);

export class PaymentFlowError extends Error {
  /** @param {number} status @param {string} message @param {boolean} [persist] gravar o banco mesmo assim */
  constructor(status, message, persist = false) {
    super(message);
    this.status = status;
    this.persist = persist;
  }
}

const iso = (ms) => new Date(ms).toISOString();

// --- OAuth do vendedor (RF-01) ---

/**
 * Começa a conexão: grava um state de uso único (e o verificador PKCE, se ligado) e devolve a URL.
 * @param {any} config @param {any} db @param {{ id: string, role: string }} user @param {number} now
 */
export function startSellerConnection(config, db, user, now) {
  if (!SELLER_ROLES.has(user.role)) throw new PaymentFlowError(403, 'Só vendedor conecta conta Mercado Pago.');
  db.oauthStates = db.oauthStates.filter((item) => Date.parse(item.expiresAt) > now);
  const state = crypto.randomBytes(32).toString('hex');
  const pkce = config.pkce ? pkcePair() : null;
  db.oauthStates.push({ state, userId: user.id, codeVerifier: pkce?.verifier ?? null, expiresAt: iso(now + OAUTH_STATE_TTL_MS) });
  return authorizationUrl(config, state, pkce?.challenge ?? null);
}

/**
 * Volta do OAuth (rota pública, sem token: o usuário sai do state). O state é consumido sempre.
 * @param {any} config @param {any} db @param {{ code?: string, state?: string, error?: string }} query @param {number} now
 * @returns {Promise<{ status: number, message: string }>}
 */
export async function completeSellerConnection(config, db, { code, state, error }, now) {
  const record = db.oauthStates.find((item) => item.state === String(state || ''));
  db.oauthStates = db.oauthStates.filter((item) => item !== record);
  const user = record && db.users.find((item) => item.id === record.userId);
  if (!record || Date.parse(record.expiresAt) <= now || !user) return { status: 400, message: 'Link de autorização inválido, vencido ou já usado. Comece de novo pelo app.' };
  if (error) return { status: 400, message: 'A autorização foi recusada no Mercado Pago.' };
  if (!code) return { status: 400, message: 'O Mercado Pago não devolveu o código de autorização.' };
  let tokens;
  try {
    tokens = await exchangeCode(config, String(code), record.codeVerifier);
  } catch {
    return { status: 502, message: 'Não foi possível falar com o Mercado Pago agora. Tente de novo.' };
  }
  db.sellerAccounts = db.sellerAccounts.filter((item) => item.userId !== user.id);
  const account = { userId: user.id, email: user.email, connectedAt: iso(now) };
  storeTokens(config, account, tokens, now);
  db.sellerAccounts.push(account);
  return { status: 200, message: 'Conta Mercado Pago conectada. Pode voltar ao AgroTech.' };
}

/** Grava os tokens cifrados (nunca em texto puro) e a validade. */
function storeTokens(config, account, tokens, now) {
  account.mpUserId = String(tokens.user_id);
  account.accessTokenEnc = encryptToken(config.tokenKey, String(tokens.access_token));
  account.refreshTokenEnc = encryptToken(config.tokenKey, String(tokens.refresh_token));
  account.expiresAt = iso(now + Number(tokens.expires_in) * 1000);
  account.scope = tokens.scope ?? null;
  account.status = 'CONECTADA';
}

/**
 * Token válido do vendedor, renovado se vence em menos de 7 dias. Renovação recusada pelo Mercado Pago
 * desconecta o vendedor (nunca cai para o token da AgroTech).
 * @returns {Promise<{ token: string, changed: boolean }>}
 */
async function sellerToken(config, account, now) {
  if (Date.parse(account.expiresAt) - now > REFRESH_BEFORE_MS) {
    return { token: decryptToken(config.tokenKey, account.accessTokenEnc), changed: false };
  }
  try {
    const fresh = await refreshAccessToken(config, decryptToken(config.tokenKey, account.refreshTokenEnc));
    storeTokens(config, account, fresh, now);
    return { token: String(fresh.access_token), changed: true };
  } catch (error) {
    if (error.status === 0 || error.status >= 500) throw new PaymentFlowError(502, 'Pagamento indisponível agora; tente em instantes.');
    account.status = 'DESCONECTADA';
    throw new PaymentFlowError(409, 'Vendedor sem pagamento ativo: a conta Mercado Pago dele precisa ser conectada de novo.', true);
  }
}

const connectedAccount = (db, email) => db.sellerAccounts.find((item) => item.email === email && item.status === 'CONECTADA') ?? null;

// --- Pedido (RF-02, RF-03, RF-05, RF-07) ---

/**
 * Preferência do Checkout Pro: um item com o total do pedido (frete e cupom já dentro), para o valor
 * pago bater com o total. notification_url e auto_return só com APP_URL público em https: o Mercado
 * Pago recusa endereço local.
 */
function buildPreference(config, order, feeCents, returnTo, now) {
  const back = returnTo === 'app' ? `agrotech://pagamento/retorno?pedido=${order.id}` : `${config.appUrl}/?pedido=${order.id}`;
  const isPublic = /^https:\/\//.test(config.appUrl) && !/^https:\/\/(localhost|127\.|0\.0\.0\.0)/.test(config.appUrl);
  const description = order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ').slice(0, 250);
  return {
    items: [{ id: order.id, title: `Pedido ${order.id} — AgroTech`, description, quantity: 1, unit_price: order.total, currency_id: 'BRL' }],
    external_reference: order.id,
    marketplace_fee: feeCents / 100,
    back_urls: { success: back, failure: back, pending: back },
    ...(isPublic ? { notification_url: `${config.appUrl}/api/payments/webhook`, auto_return: 'approved' } : {}),
    expires: true,
    expiration_date_from: iso(now),
    expiration_date_to: iso(now + config.reservationMs)
  };
}

/**
 * Prepara o pedido para pagar: um vendedor só, conectado; cria a preferência com o token dele e a
 * comissão; marca o pedido como aguardando, com a reserva de estoque até vencer. Não grava nada:
 * em erro, nada do pedido entra no banco (só a renovação do token, se houve: `persist`).
 * @param {any} config @param {any} db @param {any} order @param {{ product: any }[]} lines
 * @param {unknown} returnTo @param {number} now
 */
export async function preparePayment(config, db, order, lines, returnTo, now) {
  const sellers = new Set(lines.map(({ product }) => product.ownerEmail));
  if (sellers.size !== 1) throw new PaymentFlowError(400, 'O pedido tem itens de mais de um vendedor: pague um vendedor por vez.');
  const [sellerEmail] = sellers;
  const account = connectedAccount(db, sellerEmail);
  if (!account) throw new PaymentFlowError(409, 'Vendedor sem pagamento ativo: ele ainda não conectou a conta Mercado Pago.');
  const { token, changed } = await sellerToken(config, account, now);
  const feeCents = marketplaceFeeCents(toCents(order.total), Number(db.settings.marketplaceFeePercent ?? 0));
  let preference;
  try {
    preference = await createPreference(config, token, buildPreference(config, order, feeCents, returnTo, now), order.id);
  } catch {
    throw new PaymentFlowError(502, 'Pagamento indisponível agora; tente em instantes.', changed);
  }
  markAwaiting(order, { sellerEmail, feeCents, preference, reservedUntil: iso(now + config.reservationMs) });
}

function markAwaiting(order, { sellerEmail, feeCents, preference, reservedUntil }) {
  Object.assign(order, {
    paymentStatus: AGUARDANDO,
    status: PAYMENT_STATUS_LABEL[AGUARDANDO],
    statusStep: 0,
    sellerEmail,
    marketplaceFeeCents: feeCents,
    reservedUntil,
    payment: { provider: 'mercadopago', preferenceId: preference.id, checkoutUrl: preference.init_point, paymentId: null, mpStatus: null, method: null, history: [] },
    timeline: [
      { title: 'Aguardando pagamento', time: 'Agora', completed: true },
      ...order.timeline.map((step) => ({ ...step, completed: false, time: 'Aguardando' }))
    ]
  });
}

// --- Estado pelo pagamento consultado (RF-04, RF-05) ---

/** Devolve ao estoque o que o pedido reservou. Chamado só na transição, então uma vez por pedido. */
function restoreStock(db, order) {
  for (const item of order.items || []) {
    const product = db.products.find((candidate) => candidate.id === item.id);
    if (product && typeof product.stock === 'number') product.stock += Number(item.quantity) || 0;
  }
}

function transition(db, order, to, { source, payment, now }) {
  const from = order.paymentStatus;
  order.paymentStatus = to;
  order.status = PAYMENT_STATUS_LABEL[to];
  if (payment) Object.assign(order.payment, { paymentId: String(payment.id), mpStatus: payment.status, method: payment.payment_type_id ?? null });
  order.payment.history.push({ at: iso(now), from, to, source });
  if (to === PAGO) {
    order.statusStep = 1;
    const confirmed = order.timeline.find((step) => step.title === 'Pedido Confirmado');
    if (confirmed) Object.assign(confirmed, { completed: true, time: 'Hoje' });
  }
  if (to === CANCELADO || to === ESTORNADO) {
    restoreStock(db, order);
    order.timeline.push({ title: PAYMENT_STATUS_LABEL[to], time: 'Hoje', completed: true });
  }
}

/**
 * Aplica um pagamento consultado no Mercado Pago ao pedido. Repetir o mesmo pagamento não muda nada.
 * @returns {boolean} se o pedido mudou
 */
export function applyPayment(config, db, order, payment, collectorId, source, now) {
  const decision = paymentDecision(order, payment, collectorId);
  if (decision.review) {
    if (order.paymentReview?.paymentId === String(payment.id)) return false;
    order.paymentReview = { reason: decision.review, paymentId: String(payment.id), at: iso(now) };
    console.warn(`[agrotech] pagamento ${payment.id} do pedido ${order.id} precisa de revisão: ${decision.review}`);
    return true;
  }
  if (decision.to) {
    transition(db, order, decision.to, { source, payment, now });
    return true;
  }
  if (decision.holdUntil !== undefined) return holdReservation(config, order, decision.holdUntil, now);
  return false;
}

/** Pagamento pendente (boleto, Pix) segura a reserva até o vencimento dele. */
function holdReservation(config, order, holdUntil, now) {
  const until = holdUntil ?? iso(now + config.reservationMs);
  if (Date.parse(until) <= Date.parse(order.reservedUntil)) return false;
  order.reservedUntil = until;
  return true;
}

const isAwaitingMercadoPago = (order) => order.payment?.provider === 'mercadopago' && order.paymentStatus === AGUARDANDO;

/**
 * Consulta os pagamentos do pedido no Mercado Pago e aplica; reserva vencida sem pagamento aprovado ou
 * pendente cancela e devolve o estoque.
 * @returns {Promise<boolean>} se o banco mudou
 */
export async function syncOrder(config, db, order, now) {
  if (order.payment?.provider !== 'mercadopago') return false;
  const account = db.sellerAccounts.find((item) => item.email === order.sellerEmail && item.status === 'CONECTADA');
  let changed = false;
  if (account) {
    const access = await sellerToken(config, account, now);
    changed = access.changed;
    for (const payment of await searchPayments(config, access.token, order.id)) {
      changed = applyPayment(config, db, order, payment, account.mpUserId, 'sync', now) || changed;
    }
  }
  if (isAwaitingMercadoPago(order) && Date.parse(order.reservedUntil) <= now) {
    transition(db, order, CANCELADO, { source: 'vencimento', now });
    changed = true;
  }
  return changed;
}

/**
 * Varredura periódica: pedidos aguardando com reserva vencida ou pendentes há mais de 2 minutos são
 * reconsultados. Erro de um pedido não para os outros.
 * ponytail: uma consulta ao Mercado Pago por pedido pendente a cada passada; se o volume crescer,
 * consultar em lote por data (`/v1/payments/search?range=date_last_updated`).
 */
export async function sweepPayments(config, db, now) {
  let changed = false;
  for (const order of db.orders.filter(isAwaitingMercadoPago)) {
    const due = Date.parse(order.reservedUntil) <= now || now - Date.parse(order.createdAt) >= SYNC_PENDING_AFTER_MS;
    if (!due) continue;
    try {
      changed = (await syncOrder(config, db, order, now)) || changed;
    } catch (error) {
      changed = changed || Boolean(error.persist);
      console.warn(`[agrotech] varredura do pedido ${order.id}: ${error.message}`);
    }
  }
  return changed;
}

/**
 * Notificação já com assinatura válida. Só o tópico `payment` decide; `merchant_order` é ignorado (a
 * varredura e o sync cobrem). A conta do vendedor sai do `user_id` da notificação.
 * @returns {Promise<boolean>} se o banco mudou
 */
export async function processNotification(config, db, { type, dataId, userId }, now) {
  if (type !== 'payment') return false;
  const account = db.sellerAccounts.find((item) => item.mpUserId === String(userId) && item.status === 'CONECTADA');
  if (!account) {
    console.warn(`[agrotech] notificação do pagamento ${dataId} sem vendedor conectado com esse user_id; a varredura cobre.`);
    return false;
  }
  const access = await sellerToken(config, account, now);
  const payment = await getPayment(config, access.token, dataId);
  const order = db.orders.find((item) => item.id === payment?.external_reference);
  if (!order || order.payment?.provider !== 'mercadopago') return access.changed;
  return applyPayment(config, db, order, payment, account.mpUserId, 'webhook', now) || access.changed;
}
