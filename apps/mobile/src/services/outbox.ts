// Envio da fila offline de anúncios. Uma fila por conta, guardada no aparelho; só a própria conta
// envia. Sem sincronização em segundo plano: envia ao abrir o app, quando o catálogo volta a carregar
// do servidor e pelo botão "Enviar agora".
import { newOutboxItem, type OutboxItem } from '../lib/outbox.ts';
import { ApiError } from './api.ts';
import { newIdempotencyKey } from './orders.ts';
import { createProduct, type NewProduct } from './products.ts';
import { readCache, saveCache } from './storage.ts';

const keyFor = (owner: string) => `outbox:listings:${owner}` as const;

export async function readOutbox(owner: string): Promise<OutboxItem[]> {
  return (await readCache<OutboxItem[]>(keyFor(owner), owner))?.data ?? [];
}

async function writeOutbox(owner: string, items: OutboxItem[]): Promise<void> {
  await saveCache(keyFor(owner), items, owner);
}

export async function enqueueListing(payload: NewProduct, owner: string): Promise<OutboxItem> {
  const item = newOutboxItem(payload, owner, newIdempotencyKey().replace(/^ord-/, 'lst-'));
  await writeOutbox(owner, [...(await readOutbox(owner)), item]);
  return item;
}

export async function discardOutboxItem(owner: string, key: string): Promise<void> {
  await writeOutbox(owner, (await readOutbox(owner)).filter((item) => item.key !== key));
}

/**
 * Envia os anúncios pendentes, na ordem. Sucesso sai da fila. Sem rede: continua pendente e para
 * (os seguintes também falhariam). 401: para sem mexer (a sessão caiu). Outra recusa (400, 409): vira
 * falha com a mensagem, para a pessoa ver e descartar.
 */
export async function flushOutbox(owner: string): Promise<{ sent: number; pending: number; failed: number }> {
  const queue = await readOutbox(owner);
  const remaining: OutboxItem[] = [];
  let sent = 0;
  let stop = false;
  for (const item of queue) {
    if (stop || item.status !== 'pending') {
      remaining.push(item);
      continue;
    }
    try {
      await createProduct(item.payload, item.key);
      sent += 1;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 0 || status === 401) {
        remaining.push({ ...item, attempts: item.attempts + (status === 0 ? 1 : 0) });
        stop = true;
      } else {
        remaining.push({ ...item, attempts: item.attempts + 1, status: 'failed', error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  if (queue.length > 0) await writeOutbox(owner, remaining);
  return {
    sent,
    pending: remaining.filter((item) => item.status === 'pending').length,
    failed: remaining.filter((item) => item.status === 'failed').length
  };
}
