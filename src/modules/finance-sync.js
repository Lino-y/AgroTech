// @ts-check

/**
 * Carga do extrato financeiro na tela. Cada carga começa com um extrato novo, vazio e em
 * "carregando": nada da carga anterior (nem de outra conta, depois de sair e entrar) aparece
 * enquanto a resposta não chega, e uma resposta atrasada cai no extrato antigo, que a tela já
 * não mostra. Sem DOM: a tela passa a busca e o desenho.
 * @param {{ finance: { entries: unknown[], loading: boolean, error: string | null } }} state
 * @param {{ load: () => Promise<unknown[]>, render: () => void }} deps
 * @returns {Promise<void>}
 */
export async function syncFinance(state, { load, render }) {
  /** @type {{ entries: unknown[], loading: boolean, error: string | null }} */
  const finance = { entries: [], loading: true, error: null };
  state.finance = finance;
  render();
  try {
    finance.entries = await load();
  } catch (error) {
    finance.error = (error instanceof Error && error.message) || 'Não foi possível carregar o financeiro.';
  }
  finance.loading = false;
  render();
}
