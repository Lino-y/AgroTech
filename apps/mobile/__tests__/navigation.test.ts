// Navegação do app: abas, pilha, botão voltar do Android e login que volta para onde a pessoa ia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { afterAuth, back, INITIAL_NAV, open, openTab, pendingReason, requireLogin, type Nav } from '../src/lib/navigation.ts';

test('abrir uma aba limpa a pilha', () => {
  const nav = open(INITIAL_NAV, { name: 'product', product: { id: '1', name: 'Ração', price: 89.9 } }, false);
  assert.equal(nav.stack.length, 1);
  assert.deepEqual(openTab(nav, 'cart', false), { tab: 'cart', stack: [] });
});

test('voltar desempilha; sem pilha volta ao catálogo; no catálogo sai do app (null)', () => {
  let nav: Nav | null = open(openTab(INITIAL_NAV, 'cart', false), { name: 'product', product: { id: '1', name: 'Ração', price: 89.9 } }, false);
  nav = back(nav);
  assert.deepEqual(nav, { tab: 'cart', stack: [] });
  nav = back(nav!);
  assert.deepEqual(nav, { tab: 'catalog', stack: [] });
  assert.equal(back(nav!), null);
});

test('aba protegida sem login abre a entrada e, depois do login, vai para a aba', () => {
  const nav = openTab(INITIAL_NAV, 'finance', false);
  assert.equal(nav.tab, 'catalog');
  assert.deepEqual(nav.stack, [{ name: 'auth', pending: { tab: 'finance' }, mode: 'login' }]);
  assert.deepEqual(afterAuth(nav), { tab: 'finance', stack: [] });
});

test('com login, aba protegida abre direto', () => {
  assert.deepEqual(openTab(INITIAL_NAV, 'sell', true), { tab: 'sell', stack: [] });
});

test('pedidos sem login pedem entrada e voltam para os pedidos', () => {
  const nav = open(openTab(INITIAL_NAV, 'account', false), { name: 'orders' }, false);
  assert.deepEqual(nav.stack, [{ name: 'auth', pending: { route: { name: 'orders' } }, mode: 'login' }]);
  assert.deepEqual(afterAuth(nav), { tab: 'account', stack: [{ name: 'orders' }] });
});

test('finalizar compra sem login: entra e volta ao carrinho', () => {
  const nav = requireLogin(openTab(INITIAL_NAV, 'cart', false), { tab: 'cart' });
  assert.deepEqual(afterAuth(nav), { tab: 'cart', stack: [] });
});

test('entrada aberta pela aba Conta (sem destino) só fecha', () => {
  const nav = requireLogin(openTab(INITIAL_NAV, 'account', false), null);
  assert.deepEqual(afterAuth(nav), { tab: 'account', stack: [] });
});

test('Criar conta abre a entrada já na aba de cadastro', () => {
  const nav = requireLogin(INITIAL_NAV, null, 'register');
  assert.deepEqual(nav.stack, [{ name: 'auth', pending: null, mode: 'register' }]);
});

test('o motivo da entrada usa os textos da web', () => {
  assert.equal(pendingReason({ tab: 'sell' }), 'anunciar um produto');
  assert.equal(pendingReason({ tab: 'finance' }), 'acessar o financeiro');
  assert.equal(pendingReason({ tab: 'cart' }), 'finalizar a compra');
  assert.equal(pendingReason({ route: { name: 'orders' } }), 'ver seus pedidos');
  assert.equal(pendingReason(null), null);
});

test('suporte abre para visitante; favoritos e usuários pedem conta e voltam depois do login', () => {
  assert.deepEqual(open(INITIAL_NAV, { name: 'support' }, false).stack, [{ name: 'support' }]);
  const fav = open(INITIAL_NAV, { name: 'favorites' }, false);
  assert.deepEqual(afterAuth(fav).stack, [{ name: 'favorites' }]);
  assert.equal(pendingReason({ route: { name: 'favorites' } }), 'ver seus favoritos');
  assert.equal(open(INITIAL_NAV, { name: 'admin' }, false).stack[0].name, 'auth');
});

test('Receber pelo Mercado Pago e Pagamentos (master) pedem conta e voltam depois do login', () => {
  const receive = open(INITIAL_NAV, { name: 'receive' }, false);
  assert.equal(receive.stack[0].name, 'auth');
  assert.deepEqual(afterAuth(receive).stack, [{ name: 'receive' }]);
  assert.equal(pendingReason({ route: { name: 'receive' } }), 'receber pelo Mercado Pago');
  assert.equal(open(INITIAL_NAV, { name: 'paymentsAdmin' }, false).stack[0].name, 'auth');
  assert.deepEqual(open(INITIAL_NAV, { name: 'paymentsAdmin' }, true).stack, [{ name: 'paymentsAdmin' }]);
});
