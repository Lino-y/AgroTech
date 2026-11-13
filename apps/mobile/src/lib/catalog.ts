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

/** Data ISO (ex.: createdAt do pedido) em dd/mm/aaaa, no fuso do aparelho. Vazio se inválida. */
export function formatDate(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
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

/** Data e hora ISO em dd/mm/aaaa hh:mm (quando o dado offline foi salvo). Vazio se inválida. */
export function formatDateTime(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(iso)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Produto como vai para o armazenamento local: só o que cartão, detalhe e revalidação usam. Fica de
 * fora o que é pesado ou de outra pessoa: comentários, dono e foto em base64 (até 2 MB; o Android
 * limita o armazenamento local a uns 6 MB). Foto por link http(s) continua.
 */
export function slimProduct(product: Product): Product {
  const { id, name, price, unit, category, location, rating, imageEmoji, imageBg, description, sellerName, stock, image } = product;
  // Sem ownerEmail de propósito: o carrinho de um vendedor só (spec 10) confere o dono pelo catálogo ao vivo
  // no fechamento (cartSellerProblem), não pelo que ficou salvo no aparelho.
  const slim: Product = { id, name, price, unit, category, location, rating, imageEmoji, imageBg, description, sellerName, stock };
  if (typeof image === 'string' && /^https?:\/\//i.test(image)) slim.image = image;
  for (const key of Object.keys(slim) as (keyof Product)[]) if (slim[key] === undefined) delete slim[key];
  return slim;
}

export type CatalogSource = { items: Product[]; source: 'live' | 'cache' | 'snapshot'; savedAt: string | null };

/** Sem rede: o último catálogo consultado, com a data; sem ele, o catálogo de demonstração embutido. */
export function offlineCatalog(saved: { savedAt: string; data: Product[] } | null, snapshot: Product[]): CatalogSource {
  if (saved && saved.data.length > 0) return { items: saved.data, source: 'cache', savedAt: saved.savedAt };
  return { items: snapshot, source: 'snapshot', savedAt: null };
}
