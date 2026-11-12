// Catálogo somente leitura (GET /api/products). Só os campos que a tela usa.
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
};

export function loadProducts(): Promise<Product[]> {
  return apiRequest<Product[]>('/products');
}
