// Favoritos da conta, guardados no aparelho como na web (que também não sincroniza com o servidor).
// Ficam salvos enxutos (sem comentários nem foto em base64), então a lista abre mesmo sem rede.
import { slimProduct } from '../lib/catalog.ts';
import type { Product } from './products.ts';
import { readCache, saveCache } from './storage.ts';

const keyFor = (owner: string) => `favorites:${owner}` as const;

export async function loadFavorites(owner: string): Promise<Product[]> {
  return (await readCache<Product[]>(keyFor(owner), owner))?.data ?? [];
}

/** Liga ou desliga o favorito e devolve a lista nova. */
export async function toggleFavorite(owner: string, product: Product): Promise<Product[]> {
  const current = await loadFavorites(owner);
  const next = current.some((item) => item.id === product.id)
    ? current.filter((item) => item.id !== product.id)
    : [slimProduct(product), ...current];
  await saveCache(keyFor(owner), next, owner);
  return next;
}
