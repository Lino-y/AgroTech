// Catálogo somente leitura (GET /api/products). Só os campos que a tela usa.
import { apiRequest } from './api.ts';

export type Product = {
  id: string;
  name: string;
  price: number;
  unit?: string;
  category?: string;
};

export function loadProducts(): Promise<Product[]> {
  return apiRequest<Product[]>('/products');
}
