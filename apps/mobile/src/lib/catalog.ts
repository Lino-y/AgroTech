// Regras do catálogo que a tela usa. Funções puras: sem React Native, testadas no Node.
// Mesma lógica de busca da web (src/services/catalog-view.js): sem acento e sem diferenciar maiúscula.
import type { Product } from '../services/products.ts';

export const ALL_CATEGORIES = 'Todos';

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Filtra por busca (nome ou categoria) e por categoria. Categoria nula ou "Todos" não filtra. */
export function filterProducts(products: Product[], term: string, category: string | null): Product[] {
  const needle = normalizeText(term.trim());
  return products.filter((product) => {
    if (category && category !== ALL_CATEGORIES && product.category !== category) return false;
    if (!needle) return true;
    return normalizeText(`${product.name} ${product.category ?? ''}`).includes(needle);
  });
}

/** Categorias únicas, na ordem em que aparecem nos produtos. */
export function categoriesOf(products: Product[]): string[] {
  const seen: string[] = [];
  for (const product of products) {
    if (product.category && !seen.includes(product.category)) seen.push(product.category);
  }
  return seen;
}

/** Preço em reais no padrão brasileiro: R$ 1.234,50. */
export function formatPrice(value: number): string {
  const [integer, decimals] = Math.abs(value).toFixed(2).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${value < 0 ? '-' : ''}${grouped},${decimals}`;
}

export function countLabel(count: number): string {
  return count === 1 ? '1 item' : `${count} itens`;
}

/** Data AAAA-MM-DD do instantâneo embutido, no formato dd/mm/aaaa. */
export function snapshotLabel(isoDate: string): string {
  return isoDate.split('-').reverse().join('/');
}

/**
 * Só troca pelo catálogo embutido quando a rede falhou (status 0) e não há produto na tela.
 * Erro do servidor (4xx/5xx) é outro problema, e dado velho nunca cobre dado que já está na tela.
 */
export function shouldUseSnapshot(status: number, productsOnScreen: number): boolean {
  return status === 0 && productsOnScreen === 0;
}
