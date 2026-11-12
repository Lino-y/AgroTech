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
