// Pendências do app (#62): fila offline de anúncios, favoritos, versão do app (426), avaliações,
// redefinição de senha, administrador e o rascunho da "IA" do anúncio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../src/config.ts';
import { draftFromPrompt } from '../src/domain.ts';
import { newOutboxItem } from '../src/lib/outbox.ts';
import { draftToForm } from '../src/lib/sell.ts';
import { validateRegister } from '../src/lib/forms.ts';
import { createResetCode, loadUsers } from '../src/services/admin.ts';
import { ApiError, apiRequest, onAppOutdated } from '../src/services/api.ts';
import { resetPassword } from '../src/services/auth.ts';
import { loadFavorites, toggleFavorite } from '../src/services/favorites.ts';
import { discardOutboxItem, enqueueListing, flushOutbox, readOutbox } from '../src/services/outbox.ts';
import { addReview } from '../src/services/products.ts';
import { clearSession, setKeyValueStore, setSession, type KeyValueStore } from '../src/services/storage.ts';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    }
  };
}

type Sent = { url: string; method?: string; body: unknown; headers: Record<string, string> };

/** Troca o fetch por respostas em fila; devolve o que foi enviado. */
async function withResponses(replies: (() => Response)[], fn: () => Promise<void>): Promise<Sent[]> {
  const original = globalThis.fetch;
  const sent: Sent[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: init?.headers as Record<string, string> });
    const next = replies.shift();
    if (!next) throw new Error('resposta não prevista');
    return next();
  }) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
  return sent;
}
const json = (status: number, body: unknown) => () =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const offline = () => {
  throw new TypeError('Network request failed');
};

const LISTING = { name: 'Soja', price: 150, category: 'Grãos', description: 'granel', unit: 'tonelada', stock: 40, location: 'Rio Verde - GO' };

// --- versão do app ---

test('a versão do app no código é a mesma do app.json', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.equal(APP_VERSION, app.expo.version);
});

test('toda requisição leva X-App-Version; 426 avisa o app com a versão mínima', async () => {
  let minVersion: string | null = null;
  onAppOutdated((min) => {
    minVersion = min;
  });
  try {
    const sent = await withResponses([json(426, { message: 'Atualize o app: a versão mínima é 9.0.0.', minVersion: '9.0.0' })], async () => {
      await assert.rejects(apiRequest('/products'), (error: unknown) => error instanceof ApiError && error.status === 426);
    });
    assert.equal(sent[0].headers['X-App-Version'], APP_VERSION);
    assert.equal(minVersion, '9.0.0');
  } finally {
    onAppOutdated(null);
  }
});

// --- senha ---

test('cadastro no app exige senha de 8 caracteres, como o servidor', () => {
  assert.match(validateRegister({ name: 'Ana', email: 'a@b.co', password: '1234567' }) ?? '', /8 caracteres/);
  assert.equal(validateRegister({ name: 'Ana', email: 'a@b.co', password: '12345678' }), null);
});

test('redefinir senha manda e-mail, código e senha nova', async () => {
  const sent = await withResponses([json(204, null)], async () => {
    await resetPassword('ana@x.com', 'K7P2X9QM', 'nova-senha-1');
  });
  assert.match(sent[0].url, /\/api\/auth\/reset-password$/);
  assert.deepEqual(sent[0].body, { email: 'ana@x.com', code: 'K7P2X9QM', password: 'nova-senha-1' });
});

test('administrador lista usuários e gera o código de um deles', async () => {
  await setSession({ token: 'tok-admin', user: { id: 'adm' } });
  const sent = await withResponses([json(200, [{ id: 'u1', name: 'Ana' }]), json(201, { code: 'K7P2X9QM', expiresAt: '2026-11-12T20:00:00Z' })], async () => {
    assert.equal((await loadUsers()).length, 1);
    assert.equal((await createResetCode('u1')).code, 'K7P2X9QM');
  });
  assert.match(sent[0].url, /\/api\/admin\/users$/);
  assert.match(sent[1].url, /\/api\/admin\/users\/u1\/reset-code$/);
  assert.equal(sent[1].method, 'POST');
  await clearSession();
});

// --- avaliações ---

test('avaliação vai para POST /api/products/:id/reviews com texto e nota', async () => {
  await setSession({ token: 'tok', user: { id: 'u1' } });
  const sent = await withResponses([json(201, { review: { id: 'r1', text: 'Bom', rating: 4 }, rating: 4.5, reviewsCount: 2 })], async () => {
    const result = await addReview('3', { text: 'Bom', rating: 4 });
    assert.equal(result.reviewsCount, 2);
  });
  assert.match(sent[0].url, /\/api\/products\/3\/reviews$/);
  assert.deepEqual(sent[0].body, { text: 'Bom', rating: 4 });
  await clearSession();
});

// --- favoritos ---

test('favoritos são da conta: liga, desliga e não aparecem para outra conta', async () => {
  setKeyValueStore(memoryStore());
  const milho = { id: '3', name: 'Milho', price: 450, comments: [{ text: 'x' }] } as never;
  let list = await toggleFavorite('usr-ana', milho);
  assert.deepEqual(list.map((p) => p.id), ['3']);
  assert.equal('comments' in list[0], false, 'favorito salvo enxuto');
  assert.deepEqual((await loadFavorites('usr-bia')).map((p) => p.id), []);
  list = await toggleFavorite('usr-ana', milho);
  assert.deepEqual(list, []);
});

test('favoritos continuam depois de sair da conta (como na web)', async () => {
  setKeyValueStore(memoryStore());
  await toggleFavorite('usr-ana', { id: '3', name: 'Milho', price: 450 });
  await clearSession();
  assert.equal((await loadFavorites('usr-ana')).length, 1);
});

// --- fila offline de anúncios (RN06: só anúncio entra) ---

test('item da fila guarda chave, dono, data, tentativas, situação e só os campos do anúncio', () => {
  const item = newOutboxItem(LISTING, 'usr-ana', 'lst-abc12345', new Date('2026-11-12T10:00:00Z'));
  assert.deepEqual(item, {
    key: 'lst-abc12345',
    owner: 'usr-ana',
    createdAt: '2026-11-12T10:00:00.000Z',
    attempts: 0,
    status: 'pending',
    payload: LISTING
  });
});

test('pedido, pagamento ou lançamento financeiro nunca entram na fila (RN06)', () => {
  for (const extra of [{ items: [{ id: '1', quantity: 1 }] }, { amount: 300, type: 'EXPENSE' }, { payment: 'pix' }, { coupon: 'AGRO10' }]) {
    assert.throws(() => newOutboxItem({ ...LISTING, ...extra } as never, 'usr-ana', 'lst-abc12345'), /só anúncio/);
  }
});

test('enviar a fila: sucesso sai da fila; a chave é a mesma em toda tentativa', async () => {
  setKeyValueStore(memoryStore());
  await setSession({ token: 'tok', user: { id: 'usr-ana' } });
  const item = await enqueueListing(LISTING, 'usr-ana');
  let sent = await withResponses([offline], async () => {
    assert.deepEqual(await flushOutbox('usr-ana'), { sent: 0, pending: 1, failed: 0 });
  });
  assert.equal(sent[0].headers['Idempotency-Key'], item.key);
  assert.equal((await readOutbox('usr-ana'))[0].attempts, 1);
  sent = await withResponses([json(201, { id: 'prd-1', ...LISTING })], async () => {
    assert.deepEqual(await flushOutbox('usr-ana'), { sent: 1, pending: 0, failed: 0 });
  });
  assert.equal(sent[0].headers['Idempotency-Key'], item.key);
  assert.deepEqual(sent[0].body, LISTING);
  assert.deepEqual(await readOutbox('usr-ana'), []);
  await clearSession();
});

test('anúncio recusado (409/400) vira falha com a mensagem; 401 para o envio sem perder nada', async () => {
  setKeyValueStore(memoryStore());
  await setSession({ token: 'tok', user: { id: 'usr-ana' } });
  await enqueueListing(LISTING, 'usr-ana');
  await enqueueListing({ ...LISTING, name: 'Milho' }, 'usr-ana');
  await withResponses([json(409, { message: 'Essa Idempotency-Key já foi usada com outro anúncio.' }), json(401, { message: 'Sessão encerrada.' })], async () => {
    assert.deepEqual(await flushOutbox('usr-ana'), { sent: 0, pending: 1, failed: 1 });
  });
  const queue = await readOutbox('usr-ana');
  assert.equal(queue[0].status, 'failed');
  assert.match(queue[0].error ?? '', /Idempotency-Key/);
  assert.equal(queue[1].status, 'pending');
  await discardOutboxItem('usr-ana', queue[0].key);
  assert.equal((await readOutbox('usr-ana')).length, 1);
  await clearSession();
});

test('a fila de uma conta não é enviada nem vista por outra', async () => {
  setKeyValueStore(memoryStore());
  await enqueueListing(LISTING, 'usr-ana');
  assert.deepEqual(await readOutbox('usr-bia'), []);
  const sent = await withResponses([], async () => {
    assert.deepEqual(await flushOutbox('usr-bia'), { sent: 0, pending: 0, failed: 0 });
  });
  assert.equal(sent.length, 0);
});

// --- "IA" do anúncio ---

test('o rascunho da IA vira o formulário: preço em reais, categoria só se existir', () => {
  const draft = draftFromPrompt('Vendo 40 toneladas de soja a granel por 150 reais em Rio Verde - GO');
  const form = draftToForm(draft, ['Rações', 'Fertilizantes', 'Grãos', 'Máquinas', 'Outros']);
  assert.equal(form.name, 'Soja Granel');
  assert.equal(form.price, '150,00');
  assert.equal(form.category, 'Grãos');
  assert.equal(form.stock, '40');
  assert.equal(form.unit, 'tonelada');
  assert.equal(form.location, 'Rio Verde - GO');
  assert.ok((form.description ?? '').length > 20);
  assert.equal(draftToForm({ ...draft, category: 'Sementes' }, ['Grãos']).category, undefined);
});
