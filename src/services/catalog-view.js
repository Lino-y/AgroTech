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
