// Fila offline de anúncios (Fase 3 da spec 08): só anúncio entra. Pedido, pagamento e lançamento
// financeiro nunca (RN06): a spec só permite fila para ação não financeira e idempotente, e o anúncio
// tem Idempotency-Key no servidor (spec 05). Funções puras.
import type { NewProduct } from '../services/products.ts';

export type OutboxItem = {
  /** Idempotency-Key: criada uma vez e repetida em toda tentativa, então o reenvio nunca duplica. */
  key: string;
  owner: string;
  createdAt: string;
  attempts: number;
  /** pending: espera rede. failed: o servidor recusou (a mensagem fica em error); só sai se descartar. */
  status: 'pending' | 'failed';
  error?: string;
  payload: NewProduct;
};

const LISTING_FIELDS = new Set(['name', 'price', 'category', 'description', 'unit', 'stock', 'location']);

export function newOutboxItem(payload: NewProduct, owner: string, key: string, now = new Date()): OutboxItem {
  const extra = Object.keys(payload).filter((field) => !LISTING_FIELDS.has(field));
  if (extra.length > 0) throw new Error(`A fila offline aceita só anúncio; campos recusados: ${extra.join(', ')}`);
  return { key, owner, createdAt: now.toISOString(), attempts: 0, status: 'pending', payload };
}
