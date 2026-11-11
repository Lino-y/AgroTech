// Avaliações na lista pública (issue #62): GET /api/products não devolve o e-mail de quem avaliou.
// O vínculo (authorEmail) continua no banco, para a exclusão de conta e a exclusão da própria avaliação;
// só sai da resposta pública. A SPA mostra só autor, nota e texto (src/modules/catalog.js).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from './helpers/start-server.js';

let server;
let base;
let dataDir;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-avpub-'));
  const started = await startServer({ env: { DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '' } });
  base = started.base;
  server = started;
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

async function api(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let seq = 0;
async function newAccount(name, extra = {}) {
  const email = `avpub${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name, email, password: 'senha123', ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { email, token: res.body.token };
}

test('lista pública não traz o e-mail de quem avaliou; traz autor, nota, texto e id', async () => {
  const seller = await newAccount('Vendedor', { role: 'VENDEDOR' });
  const product = await api('POST', '/api/products', { name: 'Adubo', price: 60, category: 'Fertilizantes', description: 'lote' }, seller.token);
  const avaliador = await newAccount('Ana Avaliadora');
  const posted = await api('POST', `/api/products/${product.body.id}/reviews`, { text: 'Bom', rating: 4 }, avaliador.token);
  assert.equal(posted.status, 201);

  const listed = (await api('GET', '/api/products')).body.find((item) => item.id === product.body.id);
  assert.equal(listed.comments.length, 1);
  const [comment] = listed.comments;
  assert.equal(Object.hasOwn(comment, 'authorEmail'), false, 'o e-mail do avaliador não pode sair na lista pública');
  assert.equal(comment.author, 'Ana Avaliadora');
  assert.equal(comment.text, 'Bom');
  assert.equal(comment.rating, 4);
  assert.equal(comment.id, posted.body.review.id);
  assert.equal(JSON.stringify(listed).includes(avaliador.email), false, 'nem o e-mail em outro campo do produto');
});

test('o vínculo continua no banco: excluir a própria avaliação ainda funciona depois da lista pública', async () => {
  const seller = await newAccount('Vendedor', { role: 'VENDEDOR' });
  const product = await api('POST', '/api/products', { name: 'Semente', price: 50, category: 'Sementes', description: 'lote' }, seller.token);
  const avaliador = await newAccount('Bruno');
  const posted = await api('POST', `/api/products/${product.body.id}/reviews`, { text: 'Ótimo', rating: 5 }, avaliador.token);
  await api('GET', '/api/products');

  const removed = await api('DELETE', `/api/products/${product.body.id}/reviews/${posted.body.review.id}`, null, avaliador.token);
  assert.equal(removed.status, 204);
});
