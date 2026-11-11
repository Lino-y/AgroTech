// Exclusão de conta e avaliações (issue #62): as avaliações feitas pela conta excluída somem, com a
// nota e o total do produto recalculados. O vínculo é o e-mail gravado na avaliação (authorEmail),
// nunca o nome: duas contas com o mesmo nome não se confundem. Avaliação antiga, sem vínculo, fica.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

let server;
let base;
let dataDir;

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-avaliacoes-'));
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['apps/api/server.js'], {
    env: { ...process.env, PORT: String(port), DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('apps/api/server.js não subiu em 10s');
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
async function newAccount(name = 'Produtor', extra = {}) {
  const email = `aval${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name, email, password: 'senha123', ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { email, token: res.body.token, id: res.body.user.id };
}

async function newProduct() {
  const seller = await newAccount('Vendedor', { role: 'VENDEDOR' });
  const res = await api('POST', '/api/products', { name: 'Semente', price: 80, category: 'Sementes', description: 'lote' }, seller.token);
  assert.equal(res.status, 201);
  return res.body.id;
}

const productOf = async (id) => (await api('GET', '/api/products')).body.find((item) => item.id === id);

test('excluir a conta tira as avaliações dela, e a nota e o total do produto são recalculados', async () => {
  const productId = await newProduct();
  const saiu = await newAccount('Ana');
  const fica = await newAccount('Bruno');
  assert.equal((await api('POST', `/api/products/${productId}/reviews`, { text: 'Ruim', rating: 1 }, saiu.token)).status, 201);
  assert.equal((await api('POST', `/api/products/${productId}/reviews`, { text: 'Ótimo', rating: 5 }, fica.token)).status, 201);
  const antes = await productOf(productId);
  assert.equal(antes.reviewsCount, 2);
  assert.equal(antes.rating, 3);

  const res = await api('DELETE', '/api/auth/me', { password: 'senha123' }, saiu.token);
  assert.equal(res.status, 204);

  const depois = await productOf(productId);
  assert.deepEqual(depois.comments.map((c) => c.text), ['Ótimo']);
  assert.equal(depois.reviewsCount, 1);
  assert.equal(depois.rating, 5);
});

test('outra conta com o mesmo nome mantém a avaliação dela: o vínculo é o e-mail, não o nome', async () => {
  const productId = await newProduct();
  const saiu = await newAccount('Carlos Mendes');
  const homonimo = await newAccount('Carlos Mendes');
  await api('POST', `/api/products/${productId}/reviews`, { text: 'Da conta que sai', rating: 2 }, saiu.token);
  await api('POST', `/api/products/${productId}/reviews`, { text: 'Do homônimo', rating: 4 }, homonimo.token);

  assert.equal((await api('DELETE', '/api/auth/me', { password: 'senha123' }, saiu.token)).status, 204);

  const depois = await productOf(productId);
  assert.deepEqual(depois.comments.map((c) => c.text), ['Do homônimo']);
});

test('avaliação antiga, sem vínculo com conta, fica; produto sem avaliação da conta não muda', async () => {
  // Produto 1 do seed: as duas avaliações dele não têm authorEmail, então ninguém as "reivindica".
  const seedAntes = await productOf('1');
  const semAvaliacao = await newAccount('Sem avaliação');
  assert.equal((await api('DELETE', '/api/auth/me', { password: 'senha123' }, semAvaliacao.token)).status, 204);

  const seedDepois = await productOf('1');
  assert.deepEqual(seedDepois.comments, seedAntes.comments);
  assert.equal(seedDepois.reviewsCount, seedAntes.reviewsCount);
  assert.equal(seedDepois.rating, seedAntes.rating);
});
