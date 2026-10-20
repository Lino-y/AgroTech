// @ts-check

/**
 * Carrega o catálogo e traduz o desfecho para o estado da tela. Sucesso (lista
 * vazia inclusive) traz `products` para trocar o catálogo; falha traz só a
 * mensagem, e a tela mantém os produtos que já mostrava.
 * @param {() => Promise<unknown>} load busca os produtos (`loadProducts` de `api.js`)
 * @returns {Promise<{ products?: unknown[], productsError: string | null }>}
 */
export async function loadCatalog(load) {
  try {
    const products = await load();
    if (!Array.isArray(products)) return { productsError: 'Formato inválido de dados recebidos da API' };
    return { products, productsError: null };
  } catch (error) {
    return { productsError: (error instanceof Error && error.message) || 'Falha ao carregar produtos da API' };
  }
}
