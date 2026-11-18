// Pagamento pelo Mercado Pago na web (spec 10, parte 3c, passo 3): montagem do HTML, decisão de abrir a
// página do Mercado Pago e volta com ?pedido=. Sem navegador: o redirecionamento e o histórico entram como
// dependências, e os testes usam funções falsas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTarget, exposeOrderHandlers, finishReturn, renderMercadoPagoPayment, renderOrderPaymentActions, returnPlan } from '../src/modules/mp-checkout.js';

const checkoutUrl = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1';

test('tela de pagamento: texto sem campo de cartão, total com vírgula e a ação passada', () => {
  const html = renderMercadoPagoPayment(86, 'processPayment');
  assert.match(html, /Pagar com Mercado Pago/);
  assert.match(html, /onclick="processPayment\(\)"/);
  assert.match(html, /R\$ 86,00/);
  assert.doesNotMatch(html, /<input/, 'nenhum campo de cartão na web');
});

test('botões do pedido: aguardando sem pagamento mostra pagar, conferir e cancelar', () => {
  const html = renderOrderPaymentActions({ id: 'AGT-B403E9D09B59', paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl } });
  assert.match(html, /onclick="payOrder\('AGT-B403E9D09B59'\)"/);
  assert.match(html, /onclick="checkOrderPayment\('AGT-B403E9D09B59'\)"/);
  assert.match(html, /onclick="cancelOrderPayment\('AGT-B403E9D09B59'\)"/);
});

test('boleto em andamento: só conferir, com a explicação; sem pagar de novo', () => {
  const html = renderOrderPaymentActions({ id: 'AGT-B403E9D09B59', paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl, mpStatus: 'pending', method: 'ticket' } });
  assert.doesNotMatch(html, /payOrder/);
  assert.doesNotMatch(html, /cancelOrderPayment/);
  assert.match(html, /checkOrderPayment/);
  assert.match(html, /boleto/);
});

test('pedido pago ou simulado não tem botão; id fora do formato do servidor não entra no onclick', () => {
  assert.equal(renderOrderPaymentActions({ id: 'AGT-B403E9D09B59', paymentStatus: 'PAGO', payment: { checkoutUrl } }), '');
  assert.equal(renderOrderPaymentActions({ id: 'AGT-1', status: 'Pedido Confirmado' }), '');
  assert.equal(renderOrderPaymentActions({ id: "AGT-X'));alert(1)//", paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl } }), '');
});

test('abrir o Checkout Pro: só link https do Mercado Pago e só pedido aguardando', () => {
  assert.deepEqual(checkoutTarget({ paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl } }), { ok: true, url: checkoutUrl });
  assert.equal(checkoutTarget({ paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl: 'http://www.mercadopago.com.br/x' } }).ok, false);
  assert.equal(checkoutTarget({ paymentStatus: 'AGUARDANDO_PAGAMENTO', payment: { checkoutUrl: 'https://mercadopago.com.evil.dev/' } }).ok, false);
  assert.equal(checkoutTarget({ paymentStatus: 'PAGO', payment: { checkoutUrl } }).ok, false);
});

function fakeDeps(overrides = {}) {
  const calls = { replace: [], sync: [], notify: [], done: 0, order: [] };
  const deps = {
    search: '?pedido=AGT-B403E9D09B59&status=approved&payment_id=1',
    pathname: '/',
    history: { replaceState: (state, title, url) => { calls.replace.push(url); calls.order.push('replace'); } },
    sync: async (id) => { calls.sync.push(id); calls.order.push('sync'); return { id, paymentStatus: 'PAGO' }; },
    notify: (title, body, order) => calls.notify.push({ title, body, order }),
    onDone: () => { calls.done += 1; },
    ...overrides
  };
  return { deps, calls };
}

test('volta: limpa a URL antes de conferir, usa só o id da busca e mostra o resultado do servidor', async () => {
  const { deps, calls } = fakeDeps();
  const id = await finishReturn(deps);
  assert.equal(id, 'AGT-B403E9D09B59');
  assert.deepEqual(calls.order, ['replace', 'sync'], 'a URL é limpa antes da consulta');
  assert.deepEqual(calls.replace, ['/']);
  assert.deepEqual(calls.sync, ['AGT-B403E9D09B59']);
  assert.equal(calls.notify[0].title, 'Pagamento aprovado');
  assert.equal(calls.done, 1);
});

test('volta sem pedido válido: nada é consultado nem limpo', async () => {
  const { deps, calls } = fakeDeps({ search: '?status=approved&pedido=AGT-AB' });
  assert.equal(await finishReturn(deps), null);
  assert.equal(calls.sync.length, 0);
  assert.equal(calls.replace.length, 0);
});

test('volta com erro no servidor: avisa para conferir depois e não mostra "aprovado"', async () => {
  const { deps, calls } = fakeDeps({ sync: async () => { throw new Error('fora do ar'); } });
  await finishReturn(deps);
  assert.match(calls.notify[0].title, /Não deu para conferir/);
  assert.doesNotMatch(calls.notify[0].title, /aprovado/);
  assert.equal(calls.done, 1);
});

test('exposeOrderHandlers publica as três ações em window e as repassa ao chamador', () => {
  const seen = [];
  globalThis.window = {};
  try {
    exposeOrderHandlers({
      payOrder: (id) => seen.push(['pagar', id]),
      checkOrderPayment: (id) => seen.push(['conferir', id]),
      cancelOrderPayment: (id) => seen.push(['cancelar', id])
    });
    globalThis.window.payOrder('AGT-B403E9D09B59');
    globalThis.window.checkOrderPayment('AGT-B403E9D09B59');
    globalThis.window.cancelOrderPayment('AGT-B403E9D09B59');
    assert.deepEqual(seen, [['pagar', 'AGT-B403E9D09B59'], ['conferir', 'AGT-B403E9D09B59'], ['cancelar', 'AGT-B403E9D09B59']]);
  } finally {
    delete globalThis.window;
  }
});

test('volta: o servidor chega ao aviso (pago vira sucesso); no erro, o aviso vem sem pedido', async () => {
  const ok = fakeDeps();
  await finishReturn(ok.deps);
  assert.equal(ok.calls.notify[0].order.paymentStatus, 'PAGO');
  const fail = fakeDeps({ sync: async () => { throw new Error('fora do ar'); } });
  await finishReturn(fail.deps);
  assert.equal(fail.calls.notify[0].order, undefined);
});

test('plano da volta: no simulado ou sem pedido válido não faz nada', () => {
  const search = '?pedido=AGT-B403E9D09B59&status=approved';
  assert.deepEqual(returnPlan({ search, payments: 'simulado', loggedIn: true }), { action: 'skip' });
  assert.deepEqual(returnPlan({ search: '?status=approved', payments: 'mercadopago', loggedIn: true }), { action: 'skip' });
  assert.deepEqual(returnPlan({ search: '?pedido=AGT-AB', payments: 'mercadopago', loggedIn: false }), { action: 'skip' });
});

test('plano da volta: sem sessão guarda o id para depois do login; com sessão confere já', () => {
  const search = '?pedido=AGT-B403E9D09B59&status=approved';
  assert.deepEqual(returnPlan({ search, payments: 'mercadopago', loggedIn: false }), { action: 'login', id: 'AGT-B403E9D09B59' });
  assert.deepEqual(returnPlan({ search, payments: 'mercadopago', loggedIn: true }), { action: 'run', id: 'AGT-B403E9D09B59' });
});

test('volta com sessão vencida (401): guarda o pedido para depois do login e não diz "internet"', async () => {
  const expired = Object.assign(new Error('Token inválido ou expirado.'), { status: 401 });
  const guarded = [];
  const { deps, calls } = fakeDeps({ sync: async () => { throw expired; }, onExpired: (id) => guarded.push(id) });
  await finishReturn(deps);
  assert.deepEqual(guarded, ['AGT-B403E9D09B59']);
  assert.equal(calls.notify[0].title, 'Entre de novo para conferir');
  assert.doesNotMatch(calls.notify[0].body, /internet/);
});

test('volta com pedido de outra conta (404): mostra a mensagem do servidor, não a de internet', async () => {
  const notFound = Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
  const { deps, calls } = fakeDeps({ sync: async () => { throw notFound; } });
  await finishReturn(deps);
  assert.equal(calls.notify[0].body, 'Pedido não encontrado.');
  assert.doesNotMatch(calls.notify[0].title, /internet/);
});
