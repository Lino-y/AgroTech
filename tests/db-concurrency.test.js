// Issue #39: o db.json é lido e gravado inteiro, sem trava. Estes testes sobem o server.js com
// banco descartável e reproduzem a perda de dados: criações simultâneas e arquivo corrompido.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

let server;
let base;
let dataDir;
let dataFile;

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

async function startServer() {
  // Uma asserção que falha deixa o servidor vivo e segura o runner; cada um morre antes do próximo.
  server?.kill();
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), DATA_FILE: dataFile, JWT_SECRET: '' },
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
  throw new Error('server.js não subiu em 10s');
}

before(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-db-'));
  dataFile = path.join(dataDir, 'db.json');
});

after(() => {
  server?.kill();
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

const product = (n) => ({
  name: `Lote simultâneo ${n}`,
  price: 10 + n,
  unit: 'kg',
  category: 'Grãos',
  location: 'Mato Grosso do Sul - BR',
  description: 'Criado em paralelo para o teste de concorrência',
  imageUrl: ''
});

test('criações simultâneas não se perdem e o servidor continua de pé', async () => {
  await startServer();
  const reg = await api('POST', '/api/auth/register', { name: 'Vendedor', email: 'vend-conc@agrotech.dev', password: 'senha123', role: 'VENDEDOR' });
  const token = reg.body.token;
  const before = (await api('GET', '/api/products')).body.length;

  const N = 10;
  const results = await Promise.all(Array.from({ length: N }, (_, n) => api('POST', '/api/products', product(n), token)));
  assert.deepEqual(results.map((r) => r.status), Array(N).fill(201));

  const after = await api('GET', '/api/products');
  assert.equal(after.status, 200, 'o servidor deveria seguir respondendo');
  assert.equal(after.body.length, before + N, 'alguma criação simultânea foi perdida');
  server.kill();
});

test('db.json corrompido gera erro, não é regravado com o seed', async () => {
  const corrupted = '{"users": [ isto não é json';
  writeFileSync(dataFile, corrupted, 'utf8');
  await startServer();

  const res = await api('GET', '/api/products');
  assert.equal(res.status, 500, 'arquivo corrompido não pode virar resposta 200 com o seed');
  assert.equal(readFileSync(dataFile, 'utf8'), corrupted, 'o arquivo corrompido foi apagado pelo seed');
  server.kill();
});
