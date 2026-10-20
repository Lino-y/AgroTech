// @ts-check
import { loadCatalog } from '../services/catalog-load.js';

/**
 * Carga do catálogo na tela: mostra "carregando" antes de pedir os produtos, o que também
 * esconde o erro de uma tentativa anterior, e depois mostra o desfecho. Sem DOM: a tela
 * passa o estado e as funções de buscar, gravar o cache e desenhar.
 * @param {{ products: unknown[], loadingProducts: boolean, productsError: string | null }} state
 * @param {{ load: () => Promise<unknown>, persist: () => void, render: () => void }} deps
 * @returns {Promise<void>}
 */
export function syncCatalog(state, { load, persist, render }) {
  state.loadingProducts = true;
  state.productsError = null;
  render();

  return loadCatalog(load)
    .then(({ products, productsError }) => {
      state.productsError = productsError;
      if (products) {
        state.products = products;
        persist();
      }
    })
    // A falha da API já chega em productsError; aqui sobra erro ao gravar o cache (ex.: localStorage cheio).
    .catch((error) => {
      state.productsError = error.message;
    })
    .finally(() => {
      state.loadingProducts = false;
      render();
    });
}
