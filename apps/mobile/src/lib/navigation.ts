// Navegação do app em estado puro: uma aba ativa e uma pilha de telas por cima dela.
// ponytail: sem @react-navigation (dependência nativa nova e outra rebuild longa); BackHandler do
// React Native cuida do botão voltar. Trocar pela biblioteca quando houver deep link ou animação.
import type { Product } from '../services/products.ts';

export type Tab = 'catalog' | 'cart' | 'sell' | 'finance' | 'account';
export type AuthMode = 'login' | 'register';
export type Route =
  | { name: 'product'; product: Product }
  | { name: 'orders' }
  | { name: 'support' }
  | { name: 'favorites' }
  | { name: 'admin' }
  | { name: 'server' }
  // Mercado Pago (spec 10): o vendedor conecta a conta; o master define comissão e estorna.
  | { name: 'receive' }
  | { name: 'paymentsAdmin' }
  | { name: 'auth'; pending: Target | null; mode?: AuthMode };
/** Para onde ir depois de entrar: uma aba ou uma tela. */
export type Target = { tab: Tab } | { route: Exclude<Route, { name: 'auth' }> };
export type Nav = { tab: Tab; stack: Route[] };

export const INITIAL_NAV: Nav = { tab: 'catalog', stack: [] };

// Como na web (navigateTo, src/modules/catalog.js): anunciar, financeiro e pedidos pedem conta.
const PROTECTED_TABS: Tab[] = ['sell', 'finance'];
const PROTECTED_ROUTES: Route['name'][] = ['orders', 'favorites', 'admin', 'receive', 'paymentsAdmin'];

export function requireLogin(nav: Nav, pending: Target | null, mode: AuthMode = 'login'): Nav {
  return { ...nav, stack: [...nav.stack, { name: 'auth', pending, mode }] };
}

export function openTab(nav: Nav, tab: Tab, loggedIn: boolean): Nav {
  if (PROTECTED_TABS.includes(tab) && !loggedIn) return requireLogin(nav, { tab });
  return { tab, stack: [] };
}

export function open(nav: Nav, route: Exclude<Route, { name: 'auth' }>, loggedIn: boolean): Nav {
  if (PROTECTED_ROUTES.includes(route.name) && !loggedIn) return requireLogin(nav, { route });
  return { ...nav, stack: [...nav.stack, route] };
}

/** Botão voltar. null quando já está no catálogo sem nada empilhado: o Android fecha o app. */
export function back(nav: Nav): Nav | null {
  if (nav.stack.length > 0) return { ...nav, stack: nav.stack.slice(0, -1) };
  if (nav.tab !== 'catalog') return INITIAL_NAV;
  return null;
}

/** Depois do login: fecha a entrada e segue para o destino guardado, se houver. */
export function afterAuth(nav: Nav): Nav {
  const top = nav.stack[nav.stack.length - 1];
  const rest = { ...nav, stack: nav.stack.slice(0, -1) };
  if (!top || top.name !== 'auth' || !top.pending) return rest;
  if ('tab' in top.pending) return { tab: top.pending.tab, stack: [] };
  return { ...rest, stack: [...rest.stack, top.pending.route] };
}

// Textos da web (pendingScreenNames, src/modules/catalog.js): "Faça login ou crie uma conta para ...".
const REASONS: Partial<Record<Tab | Route['name'], string>> = {
  cart: 'finalizar a compra',
  sell: 'anunciar um produto',
  finance: 'acessar o financeiro',
  orders: 'ver seus pedidos',
  favorites: 'ver seus favoritos',
  admin: 'administrar os usuários',
  receive: 'receber pelo Mercado Pago',
  paymentsAdmin: 'administrar os pagamentos'
};

export function pendingReason(target: Target | null): string | null {
  if (!target) return null;
  const key = 'tab' in target ? target.tab : target.route.name;
  return REASONS[key] ?? null;
}
