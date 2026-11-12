// Catálogo de demonstração embutido no app, para o modo offline. Copiado à mão do catálogo da API
// (apps/api/data/db.json), só com os campos que o cartão usa: nada de dono, comentário ou foto.
// ponytail: instantâneo fixo. O cache do último catálogo consultado (ADR-0001, Fase 3 da spec 08)
// pede armazenamento persistente (AsyncStorage, dependência nativa nova); trocar este arquivo por ele.
import type { Product } from '../services/products.ts';

/** Data em que o instantâneo foi copiado (AAAA-MM-DD). Aparece no aviso do modo offline. */
export const OFFLINE_CATALOG_DATE = '2026-11-11';

export const OFFLINE_PRODUCTS: Product[] = [
  { id: '1', name: 'Ração Bovinos Corte 30kg', price: 89.9, category: 'Rações', imageEmoji: '🐄', imageBg: '#E8F5E9', rating: 4.8 },
  { id: '2', name: 'Fertilizante NPK 10-10-10 50kg', price: 150, category: 'Fertilizantes', imageEmoji: '🧪', imageBg: '#E8F5E9', rating: 4.9 },
  { id: '3', name: 'Semente de Milho Híbrido 20kg', price: 450, category: 'Grãos', imageEmoji: '🌽', imageBg: '#F1F8E9', rating: 4.7 },
  { id: '4', name: 'Trator Fruteiro 75cv (Diária)', price: 800, category: 'Máquinas', imageEmoji: '🚜', imageBg: '#E0F2F1', rating: 5 }
];
