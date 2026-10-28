// @ts-check
import { orderDate } from './finance.js';

/**
 * Data do pedido em "Meus Pedidos": dd/mm/aaaa, no fuso de quem vê. Sai do `createdAt` ou, no
 * pedido do seed, da data legível ("15/Set/2026"), a mesma leitura do financeiro. Pedido
 * antigo gravado só com "Hoje" não tem data real: aparece como "não registrada".
 * @param {import('./finance.js').Order} order
 * @returns {string}
 */
export function formatOrderDate(order) {
  const date = new Date(orderDate(order) ?? NaN);
  return Number.isNaN(date.getTime()) ? 'não registrada' : date.toLocaleDateString('pt-BR');
}
