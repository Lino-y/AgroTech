// Catálogo (GET /api/products) e anúncios (POST e DELETE /api/products, spec 05).
import { apiRequest } from './api.ts';

export type Product = {
  id: string;
  name: string;
  price: number;
  unit?: string;
  category?: string;
  location?: string;
  rating?: number;
  /** Emoji e cor de fundo do cartão, como na web (campos imageEmoji e imageBg do servidor). */
  imageEmoji?: string;
  imageBg?: string;
  /** Foto do anúncio (link http(s) ou data URL), quando existir. */
  image?: string;
  description?: string;
  /** Dono do anúncio: "Minha Loja" mostra os da conta logada. */
  ownerEmail?: string;
  sellerName?: string;
  stock?: number;
};

// O app abre no catálogo: sem servidor alcançável, o aviso offline aparece em 5 s, não nos 10 s padrão.
const CATALOG_TIMEOUT_MS = 5000;

export function loadProducts(): Promise<Product[]> {
  return apiRequest<Product[]>('/products', { timeoutMs: CATALOG_TIMEOUT_MS });
}

export type NewProduct = {
  name: string;
  price: number;
  category: string;
  description: string;
  unit: string;
  stock: number;
  location: string;
};

export function createProduct(input: NewProduct): Promise<Product> {
  return apiRequest<Product>('/products', { method: 'POST', body: input });
}

export function deleteProduct(id: string): Promise<void> {
  return apiRequest<void>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
