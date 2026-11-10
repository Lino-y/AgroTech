// @ts-check

/** @type {Record<string, string>} */
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * Texto como o usuário o vê: o servidor grava o nome com HTML escapado (d&#39;água, &amp;), então a
 * busca desfaz isso; e ignora acento e caixa ("racao" acha "Ração"). Uma passada só, para não
 * desescapar duas vezes.
 * @param {unknown} value
 * @returns {string}
 */
function fold(value) {
  return String(value ?? '')
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * Regra da lista do catálogo na tela: categoria escolhida e termo da busca. A grade e o
 * contador usam esta mesma função, então não divergem depois de uma busca ou de um redesenho.
 * @template {{ name?: string | null, category?: string }} T
 * @param {T[] | null} products anúncios da API
 * @param {string} category 'Todos' ou uma das categorias dos anúncios
 * @param {string} term texto digitado na busca (sem diferença de maiúsculas nem de acento)
 * @returns {T[]} anúncios que passam na categoria e no termo, na mesma ordem
 */
export function filterCatalogProducts(products, category, term) {
  const list = Array.isArray(products) ? products : [];
  const existing = new Set(list.map((product) => product.category).filter(Boolean));
  const byCategory = category === 'Todos' || !existing.has(category)
    ? list
    : list.filter((product) => product.category === category);
  const needle = fold(term);
  return byCategory.filter((product) => fold(product.name).includes(needle) || fold(product.category).includes(needle));
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
