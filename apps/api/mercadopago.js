// Tudo o que conversa com o Mercado Pago (spec 10) fica aqui: configuração, OAuth do vendedor, preferência
// do Checkout Pro, consulta de pagamento, assinatura do webhook e cifra dos tokens. Usa o fetch do Node,
// sem SDK (dependência nova pede aprovação). Contrato `checkout-pro` do guia de marketplace do plugin
// oficial: preferência em /checkout/preferences com o token do vendedor e `marketplace_fee`.
import crypto from 'node:crypto';

const REQUIRED = ['MP_APP_ID', 'MP_CLIENT_SECRET', 'MP_OAUTH_REDIRECT_URI', 'MP_WEBHOOK_SECRET', 'MP_TOKEN_ENCRYPTION_KEY', 'APP_URL'];
const MP_TIMEOUT_MS = 10_000;
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Lê a configuração do ambiente. Sem nenhuma variável do Mercado Pago, o modo é o simulado de hoje.
 * Configuração pela metade é erro (o servidor não sobe): ligar o pagamento sem o segredo do webhook
 * aceitaria notificação forjada.
 * MP_API_BASE e MP_AUTH_BASE existem para os testes apontarem para um Mercado Pago falso local.
 * @param {Record<string, string | undefined>} env
 */
export function readMercadoPagoConfig(env) {
  if (!REQUIRED.some((name) => env[name])) return { mode: 'simulado' };
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) {
    return { error: `Mercado Pago configurado pela metade: faltam ${missing.join(', ')}. Preencha todas ou remova todas (modo simulado).` };
  }
  const tokenKey = Buffer.from(String(env.MP_TOKEN_ENCRYPTION_KEY), 'base64');
  if (tokenKey.length !== 32) {
    return { error: 'MP_TOKEN_ENCRYPTION_KEY precisa ter 32 bytes em base64: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"' };
  }
  const appUrl = parseHttpUrl(env.APP_URL);
  if (!appUrl) return { error: 'APP_URL precisa ser um endereço http(s), o endereço público da API.' };
  return {
    mode: 'mercadopago',
    appId: String(env.MP_APP_ID),
    clientSecret: String(env.MP_CLIENT_SECRET),
    redirectUri: String(env.MP_OAUTH_REDIRECT_URI),
    webhookSecret: String(env.MP_WEBHOOK_SECRET),
    tokenKey,
    appUrl,
    pkce: env.MP_OAUTH_PKCE === '1',
    apiBase: (env.MP_API_BASE || 'https://api.mercadopago.com').replace(/\/+$/, ''),
    authBase: (env.MP_AUTH_BASE || 'https://auth.mercadopago.com').replace(/\/+$/, ''),
    reservationMs: positiveInt(env.MP_RESERVATION_MS) ?? 30 * 60 * 1000,
    sweepMs: positiveInt(env.MP_SWEEP_MS) ?? 60 * 1000
  };
}

/** @param {string | undefined} value */
function parseHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

/** @param {string | undefined} value */
function positiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export class MercadoPagoError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.name = 'MercadoPagoError';
    this.status = status;
  }
}

/**
 * Chamada à API do Mercado Pago com timeout. O token nunca vai para mensagem de erro nem log.
 * @param {{ apiBase: string }} config
 * @param {string} path
 * @param {{ method?: string, token?: string, json?: unknown, form?: Record<string, string>, idempotencyKey?: string }} [options]
 */
async function mpFetch(config, path, { method = 'GET', token, json, form, idempotencyKey } = {}) {
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
  let body;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  let response;
  try {
    response = await fetch(config.apiBase + path, { method, headers, body, signal: AbortSignal.timeout(MP_TIMEOUT_MS) });
  } catch {
    throw new MercadoPagoError(0, 'Mercado Pago fora do alcance.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new MercadoPagoError(response.status, `Mercado Pago respondeu ${response.status}.`);
  return data;
}

// --- OAuth do vendedor (RF-01) ---

/** Par PKCE (S256): o verificador fica no servidor, o desafio vai na URL. */
export function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
}

/**
 * URL para o vendedor autorizar a AgroTech. `state` é de uso único e vem do servidor.
 * @param {ReturnType<typeof readMercadoPagoConfig> & { mode: 'mercadopago' }} config
 * @param {string} state
 * @param {string | null} challenge desafio PKCE, quando ligado
 */
export function authorizationUrl(config, state, challenge) {
  const url = new URL(`${config.authBase}/authorization`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', config.redirectUri);
  if (challenge) {
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.href;
}

/**
 * Troca o código do OAuth pelos tokens do vendedor (no servidor, nunca no app).
 * @param {any} config
 * @param {string} code
 * @param {string | null} verifier
 * @returns {Promise<{ access_token: string, refresh_token: string, expires_in: number, user_id: number | string, scope?: string }>}
 */
export function exchangeCode(config, code, verifier) {
  /** @type {Record<string, string>} */
  const form = { grant_type: 'authorization_code', client_id: config.appId, client_secret: config.clientSecret, code, redirect_uri: config.redirectUri };
  if (verifier) form.code_verifier = verifier;
  return mpFetch(config, '/oauth/token', { method: 'POST', form });
}

/**
 * Renova o token do vendedor. A resposta traz também um refresh_token novo, que substitui o antigo.
 * @param {any} config
 * @param {string} refreshToken
 */
export function refreshAccessToken(config, refreshToken) {
  return mpFetch(config, '/oauth/token', {
    method: 'POST',
    form: { grant_type: 'refresh_token', client_id: config.appId, client_secret: config.clientSecret, refresh_token: refreshToken }
  });
}

// --- Checkout Pro e pagamentos (RF-03, RF-04) ---

/**
 * Cria a preferência do Checkout Pro com o token do vendedor (sem collector_id no corpo).
 * @param {any} config
 * @param {string} sellerToken
 * @param {Record<string, unknown>} preference
 * @param {string} idempotencyKey
 * @returns {Promise<{ id: string, init_point: string }>}
 */
export const createPreference = (config, sellerToken, preference, idempotencyKey) =>
  mpFetch(config, '/checkout/preferences', { method: 'POST', token: sellerToken, json: preference, idempotencyKey });

/** @param {any} config @param {string} token @param {string} paymentId */
export const getPayment = (config, token, paymentId) =>
  mpFetch(config, `/v1/payments/${encodeURIComponent(paymentId)}`, { token });

/**
 * Pagamentos de um pedido, pelo external_reference.
 * @param {any} config @param {string} token @param {string} externalReference
 * @returns {Promise<any[]>}
 */
export async function searchPayments(config, token, externalReference) {
  const query = new URLSearchParams({ external_reference: externalReference, sort: 'date_created', criteria: 'asc' });
  const data = await mpFetch(config, `/v1/payments/search?${query}`, { token });
  return Array.isArray(data?.results) ? data.results : [];
}

// --- Assinatura do webhook (RF-04) ---

/**
 * Valida o x-signature: HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com o segredo,
 * comparado em tempo constante, e ts a no máximo 5 minutos do relógio. A documentação mostra ts em
 * segundos; uma fonte fala em milissegundos, então os dois são aceitos.
 * @param {{ xSignature?: string, xRequestId?: string, dataId?: string, secret: string, now?: number }} input
 * @returns {'ok' | 'missing' | 'invalid'}
 */
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret, now = Date.now() }) {
  const parts = Object.fromEntries(String(xSignature || '').split(',').map((part) => part.split('=').map((piece) => piece.trim())));
  const { ts, v1 } = parts;
  if (!ts || !v1 || !xRequestId || !dataId) return 'missing';
  const tsMs = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > SIGNATURE_TOLERANCE_MS) return 'invalid';
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(manifest).digest('hex'));
  const received = Buffer.from(String(v1));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received) ? 'ok' : 'invalid';
}

// --- Cifra dos tokens do vendedor em repouso (RF-01) ---

/**
 * AES-256-GCM: base64 de iv (12) + tag (16) + texto cifrado.
 * @param {Buffer} key 32 bytes
 * @param {string} plain
 */
export function encryptToken(key, plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

/**
 * Lança erro se a chave estiver errada ou o texto tiver sido alterado.
 * @param {Buffer} key
 * @param {string} sealed
 */
export function decryptToken(key, sealed) {
  const data = Buffer.from(sealed, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
