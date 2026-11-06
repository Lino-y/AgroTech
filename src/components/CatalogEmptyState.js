/**
 * Mensagem da grade do catálogo quando não há cartão. Sem anúncio publicado, quem entrou ganha o
 * caminho para anunciar; busca sem resultado não diz que o catálogo está vazio.
 * @param {'catalog' | 'search'} kind qual das duas mensagens (ver catalogEmptyKind)
 * @param {boolean} canSell usuário entrou, então pode anunciar
 * @returns {string}
 */
export function renderCatalogEmptyState(kind, canSell) {
  if (kind === 'search') {
    return `
      <div data-empty="search" style="grid-column: 1 / -1; text-align: center; padding: 24px 16px; border: 1px dashed var(--moss); border-radius: 12px; color: var(--ink); font-size: 13px;">
        Nenhum anúncio encontrado para a busca. Tente outro termo.
      </div>
    `;
  }
  return `
    <div data-empty="catalog" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 16px; border: 1px dashed var(--moss); border-radius: 12px; color: var(--ink); font-size: 13px;">
      <strong>Nenhum anúncio publicado ainda.</strong>
      ${canSell ? `<button onclick="navigateTo('sell')" style="background: var(--forest); color: var(--paper); border: none; padding: 10px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">+ Anunciar Meu Lote</button>` : ''}
    </div>
  `;
}
