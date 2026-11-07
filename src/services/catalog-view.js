// @ts-check

/**
 * Regra da lista do catálogo na tela: categoria escolhida e termo da busca. A grade e o
 * contador usam esta mesma função, então não divergem depois de uma busca ou de um redesenho.
 * @template {{ name: string, category?: string }} T
 * @param {T[]} products anúncios da API
 * @param {string} category 'Todos' ou uma das categorias dos anúncios
 * @param {string} term texto digitado na busca (sem diferença de maiúsculas)
 * @returns {T[]} anúncios que passam na categoria e no termo, na mesma ordem
 */
export function filterCatalogProducts(products, category, term) {
  const existing = new Set(products.map((product) => product.category).filter(Boolean));
  const byCategory = category === 'Todos' || !existing.has(category)
    ? products
    : products.filter((product) => product.category === category);
  const needle = term.toLowerCase();
  return byCategory.filter((product) =>
    product.name.toLowerCase().includes(needle) || (product.category ?? '').toLowerCase().includes(needle));
}

/**
 * Mensagem da grade quando nenhum cartão aparece. Carregando e falha da API têm aviso próprio
 * acima da grade, então nesses casos não se diz que não há anúncio.
 * @param {{ total: number, visible: number, loading: boolean, failed: boolean }} view total: anúncios
 *   carregados da API; visible: anúncios que passam na categoria e na busca; loading: carga em
 *   andamento; failed: a última carga falhou
 * @returns {'catalog' | 'search' | null} 'catalog' sem anúncio publicado, 'search' busca sem resultado
 */
export function catalogEmptyKind({ total, visible, loading, failed }) {
  if (visible > 0 || loading || failed) return null;
  return total === 0 ? 'catalog' : 'search';
}
