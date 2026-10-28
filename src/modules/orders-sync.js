// @ts-check

/**
 * Carga de "Meus Pedidos" (GET /api/orders), no molde de syncFinance. Cada carga começa com uma
 * lista nova, vazia e em "carregando": nada da carga anterior (nem de outra conta, depois de
 * sair e entrar) aparece enquanto a resposta não chega, e uma resposta atrasada cai na lista
 * antiga, que a tela já não mostra. Sem DOM: a tela passa a busca e o desenho.
 * @param {{ orders: { list: unknown[], loading: boolean, error: string | null } }} state
 * @param {{ load: () => Promise<unknown[]>, render: () => void }} deps
 * @returns {Promise<void>}
 */
export async function syncOrders(state, { load, render }) {
  /** @type {{ list: unknown[], loading: boolean, error: string | null }} */
  const orders = { list: [], loading: true, error: null };
  state.orders = orders;
  render();
  try {
    orders.list = await load();
  } catch (error) {
    orders.error = (error instanceof Error && error.message) || 'Não foi possível carregar os pedidos.';
  }
  orders.loading = false;
  render();
}
