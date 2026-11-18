// Pagamento pelo Mercado Pago na web (spec 10, parte 3c). Regras (link seguro, botões, mensagem) vêm do
// domínio compartilhado; aqui ficam a montagem do HTML, a decisão de abrir o Checkout Pro e a volta da
// página (?pedido=). Quem decide "pago" é sempre o servidor (POST /api/orders/{id}/sync).
import {
  isSafeCheckoutUrl, orderActions, orderIdFromSearch, paymentResultMessage
} from '../../packages/domain/payments.js';

/** @typedef {{ id?: string, status?: string, paymentStatus?: string, payment?: { checkoutUrl?: string, mpStatus?: string | null, method?: string | null } }} OrderView */

// O id vai para o atributo onclick: só entra o formato que o servidor gera.
const ORDER_ID_RE = /^AGT-[A-Z0-9]{3,40}$/;

/** @param {string} text */
const escapeText = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

const BUTTON_STYLE = 'width: 100%; padding: 14px 16px; border-radius: 14px; border: none; font-weight: 700; cursor: pointer;';
const PRIMARY = `${BUTTON_STYLE} background: var(--forest); color: var(--paper);`;
const OUTLINE = `${BUTTON_STYLE} background: var(--paper); color: var(--forest); border: 2px solid var(--moss);`;

/**
 * Tela de pagamento quando o Mercado Pago está ligado: o pedido é criado e a pessoa segue para a página do
 * Mercado Pago. Nenhum dado de cartão passa pelo AgroTech.
 * @param {number} total valor em reais, já calculado pelo servidor na criação do pedido
 * @param {string} action nome da função global que cria o pedido (ex.: 'processPayment')
 * @returns {string}
 */
export function renderMercadoPagoPayment(total, action) {
  return `
    <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; background: var(--paper);">
      <h2 style="font-family: var(--font-display); color: var(--forest); margin: 0;">Pagamento</h2>
      <p style="margin: 0; color: var(--ink);">Você paga na página do Mercado Pago: Pix, cartão ou boleto. Nenhum dado de pagamento passa pelo AgroTech.</p>
      <p style="margin: 0; font-weight: 700; color: var(--forest);">Total: R$ ${escapeText(Number(total).toFixed(2).replace('.', ','))}</p>
      <button type="button" onclick="${action}()" style="${PRIMARY}">Pagar com Mercado Pago</button>
    </div>`;
}

/**
 * Botões de um pedido em "Meus Pedidos" (regra em orderActions). Pedido sem pagamento pendente no
 * Mercado Pago, ou simulado, não tem nenhum botão.
 * @param {OrderView} order
 * @returns {string}
 */
export function renderOrderPaymentActions(order) {
  const id = String(order.id ?? '');
  if (!ORDER_ID_RE.test(id)) return '';
  const actions = orderActions(order);
  const buttons = [
    actions.pay ? `<button type="button" onclick="payOrder('${id}')" style="${PRIMARY}">Pagar agora</button>` : '',
    actions.check ? `<button type="button" onclick="checkOrderPayment('${id}')" style="${OUTLINE}">Conferir pagamento</button>` : '',
    actions.cancel ? `<button type="button" onclick="cancelOrderPayment('${id}')" style="${OUTLINE}">Cancelar pedido</button>` : ''
  ].join('');
  const note = actions.note ? `<p style="margin: 0; color: var(--ink);">${escapeText(actions.note)}</p>` : '';
  if (!buttons && !note) return '';
  return `<div style="display: flex; flex-direction: column; gap: 8px;">${note}${buttons}</div>`;
}

/**
 * Decide se a página do Mercado Pago pode ser aberta. Não abre nada: quem chama faz o redirecionamento.
 * @param {OrderView} order
 * @returns {{ ok: true, url: string } | { ok: false, message: string }}
 */
export function checkoutTarget(order) {
  const url = order.payment?.checkoutUrl;
  if (order.paymentStatus !== 'AGUARDANDO_PAGAMENTO') return { ok: false, message: 'Este pedido não está aguardando pagamento.' };
  if (!isSafeCheckoutUrl(url)) return { ok: false, message: 'O link de pagamento não é do Mercado Pago. Confira o pedido em Meus pedidos.' };
  return { ok: true, url: /** @type {string} */ (url) };
}

/**
 * Publica as ações dos botões de pedido para os onclick da página (o escopo global só enxerga window).
 * Quem decide o que cada ação faz (abrir, conferir, cancelar e redesenhar) é o chamador; aqui só se expõe.
 * @param {{ payOrder: (id: string) => void, checkOrderPayment: (id: string) => void, cancelOrderPayment: (id: string) => void }} actions
 */
export function exposeOrderHandlers(actions) {
  window.payOrder = (id) => actions.payOrder(id);
  window.checkOrderPayment = (id) => actions.checkOrderPayment(id);
  window.cancelOrderPayment = (id) => actions.cancelOrderPayment(id);
}

/**
 * Volta da página do Mercado Pago: lê o pedido da busca (?pedido=AGT-…) e confere no servidor. Não
 * decide nada pelos parâmetros do Mercado Pago (status, payment_id): o resultado vem do servidor.
 * @param {{ search: string, history: { replaceState: (state: null, title: string, url: string) => void }, pathname: string,
 *   sync: (id: string) => Promise<OrderView>, notify: (title: string, body: string, order?: OrderView) => void, onDone: () => void,
 *   onExpired?: (id: string) => void }} deps
 * @returns {Promise<string | null>} id conferido, ou null quando a busca não tem um pedido válido
 */
export async function finishReturn(deps) {
  const id = orderIdFromSearch(deps.search);
  if (!id) return null;
  // Limpa a URL antes de conferir: recarregar a página não repete a conferência.
  deps.history.replaceState(null, '', deps.pathname);
  try {
    const order = await deps.sync(id);
    const message = paymentResultMessage(order);
    deps.notify(message.title, message.body, order);
  } catch (error) {
    if (error?.status === 401) {
      // Sessão vencida: o pedido fica guardado e a pessoa entra de novo para conferir.
      deps.onExpired?.(id);
      deps.notify('Entre de novo para conferir', `O pedido ${id} continua em Meus pedidos.`);
    } else if (error?.status) {
      // Quem respondeu explicou o motivo (ex.: pedido de outra conta).
      deps.notify('Não deu para conferir', error.message || `Confira o pedido ${id} em Meus pedidos.`);
    } else {
      deps.notify('Não deu para conferir agora', `Confira o pedido ${id} em Meus pedidos quando tiver internet.`);
    }
  }
  deps.onDone();
  return id;
}

/**
 * O que fazer com a busca ao abrir a página: nada (modo simulado ou sem ?pedido= válido), conferir já, ou
 * guardar o id até a pessoa entrar. A conferência em si é finishReturn.
 * @param {{ search: string, payments: string, loggedIn: boolean }} input
 * @returns {{ action: 'skip' } | { action: 'run' | 'login', id: string }}
 */
export function returnPlan({ search, payments, loggedIn }) {
  const id = payments === 'mercadopago' ? orderIdFromSearch(search) : null;
  if (!id) return { action: 'skip' };
  return { action: loggedIn ? 'run' : 'login', id };
}

/**
 * Guarda o pedido da volta enquanto a pessoa entra de novo (sessionStorage: sobrevive a um recarregamento da
 * página, some ao fechar a aba). Falha de armazenamento (modo privado, bloqueado) não quebra nada: a volta
 * então fica só em memória. Só devolve um id no formato do servidor.
 * @param {() => { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void }} getStorage
 */
export function createReturnStore(getStorage) {
  const KEY = 'agrotech.pendingReturn';
  return {
    save(id) {
      try {
        if (id) getStorage().setItem(KEY, id);
        else getStorage().removeItem(KEY);
      } catch {
        // Sem armazenamento: a volta segue só em memória.
      }
    },
    read() {
      try {
        const value = getStorage().getItem(KEY);
        return value && ORDER_ID_RE.test(value) ? value : null;
      } catch {
        return null;
      }
    }
  };
}
