// Mercado Pago falso para os testes de API (spec 10): sobe em porta livre e responde às rotas que o
// apps/api/mercadopago.js usa. Guarda o que recebeu, para o teste conferir token, comissão e valores.
// Nunca chama o Mercado Pago de verdade.
import http from 'node:http';

function oauthToken(state, req, raw) {
  const form = Object.fromEntries(new URLSearchParams(raw));
  state.tokenRequests.push({ contentType: req.headers['content-type'], form });
  if (form.grant_type === 'refresh_token' && state.failRefresh) return [400, { error: 'invalid_grant' }];
  const suffix = state.tokenRequests.length;
  if (form.grant_type !== 'refresh_token') state.lastUserId = state.nextUserId++;
  return [200, {
    access_token: `token-falso-acesso-${suffix}`,
    refresh_token: `token-falso-renovacao-${suffix}`,
    expires_in: state.expiresIn ?? 15552000,
    user_id: state.lastUserId,
    scope: 'offline_access read write'
  }];
}

function preference(state, req, raw) {
  if (state.failPreferences) return [500, { message: 'fora do ar' }];
  const id = `pref-${state.preferences.length + 1}`;
  state.preferences.push({ authorization: req.headers.authorization, idempotencyKey: req.headers['x-idempotency-key'], body: JSON.parse(raw) });
  return [201, { id, init_point: `https://mercadopago.test/checkout?pref_id=${id}` }];
}

// Estorno total: com `refundPending`, o Mercado Pago aceita mas o pagamento ainda não muda (confirmação
// depois); com `failRefund`, recusa (ex.: vendedor sem saldo).
function refund(state, req, paymentId) {
  state.refundRequests.push({ paymentId, authorization: req.headers.authorization, idempotencyKey: req.headers['x-idempotency-key'] });
  const payment = state.payments.get(paymentId);
  if (!payment) return [404, { message: 'not found' }];
  if (state.failRefund) return [400, { message: 'insufficient balance' }];
  if (!state.refundPending) payment.status = 'refunded';
  return [201, { id: 5000 + state.refundRequests.length, payment_id: Number(paymentId), status: state.refundPending ? 'in_process' : 'approved', amount: payment.transaction_amount }];
}

function route(state, req, url, raw) {
  if (req.method === 'POST' && url.pathname === '/oauth/token') return oauthToken(state, req, raw);
  if (req.method === 'POST' && url.pathname === '/checkout/preferences') return preference(state, req, raw);
  const refundMatch = /^\/v1\/payments\/(\d+)\/refunds$/.exec(url.pathname);
  if (req.method === 'POST' && refundMatch) return refund(state, req, refundMatch[1]);
  const paymentMatch = /^\/v1\/payments\/(\d+)$/.exec(url.pathname);
  if (req.method === 'GET' && paymentMatch) {
    const payment = state.payments.get(paymentMatch[1]);
    return payment ? [200, payment] : [404, { message: 'not found' }];
  }
  if (req.method === 'GET' && url.pathname === '/v1/payments/search') {
    const ref = url.searchParams.get('external_reference');
    return [200, { results: [...state.payments.values()].filter((p) => p.external_reference === ref) }];
  }
  return [404, { message: 'rota falsa inexistente' }];
}

/**
 * @returns {Promise<{ base: string, state: any, close: () => Promise<void> }>}
 */
export function startFakeMercadoPago() {
  const state = { tokenRequests: [], preferences: [], refundRequests: [], payments: new Map(), failPreferences: false, failRefresh: false, nextUserId: 7001 };

  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const [status, body] = route(state, req, new URL(req.url, 'http://fake'), raw);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      resolve({
        base: `http://localhost:${server.address().port}`,
        state,
        close: () => new Promise((done) => server.close(() => done()))
      });
    });
  });
}
