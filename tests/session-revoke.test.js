// Revogação de sessão (issue #62, pré-requisito do app): POST /api/auth/logout encerra todas as
// sessões da conta (o token ganha uma versão, e o servidor recusa token com versão antiga), e um
// token cujo `sub` não é mais um usuário do banco não entra numa conta nova de mesmo e-mail.
// Sobe apps/api/server.js com JWT_SECRET fixo, para assinar um token "antigo" nos testes.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const SECRET = 'segredo-de-teste-sessao-62';
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

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-sessao-'));
  dataFile = path.join(dataDir, 'db.json');
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['apps/api/server.js'], {
    env: { ...process.env, PORT: String(port), DATA_FILE: dataFile, JWT_SECRET: SECRET },
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
async function newBuyer() {
  const email = `sessao${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Sessão', email, password: 'senha123' });
  return { email, token: res.body.token, id: res.body.user.id };
}

const login = async (email) => (await api('POST', '/api/auth/login', { email, password: 'senha123' })).body.token;

test('logout encerra o token em uso e todos os outros da mesma conta', async () => {
  const conta = await newBuyer();
  const outro = await login(conta.email);
  assert.equal((await api('GET', '/api/auth/me', null, conta.token)).status, 200);

  const out = await api('POST', '/api/auth/logout', null, conta.token);
  assert.equal(out.status, 204);

  const recusado = await api('GET', '/api/auth/me', null, conta.token);
  assert.equal(recusado.status, 401);
  assert.match(recusado.body.message, /Sessão encerrada/);
  assert.equal((await api('GET', '/api/auth/me', null, outro)).status, 401);
});

test('depois do logout, entrar de novo gera um token que funciona', async () => {
  const conta = await newBuyer();
  await api('POST', '/api/auth/logout', null, conta.token);
  const novo = await login(conta.email);
  assert.equal((await api('GET', '/api/auth/me', null, novo)).status, 200);
});

test('logout de uma conta não afeta a sessão de outra', async () => {
  const ana = await newBuyer();
  const bruno = await newBuyer();
  await api('POST', '/api/auth/logout', null, ana.token);
  assert.equal((await api('GET', '/api/auth/me', null, bruno.token)).status, 200);
});

test('logout exige token', async () => {
  assert.equal((await api('POST', '/api/auth/logout', null, null)).status, 401);
});

test('token de conta que saiu do banco não entra numa conta nova com o mesmo e-mail', async () => {
  const antiga = await newBuyer();
  // Tira a conta antiga do banco (o que a exclusão de conta faz) e cadastra outra com o mesmo e-mail.
  const db = JSON.parse(readFileSync(dataFile, 'utf8'));
  db.users = db.users.filter((item) => item.id !== antiga.id);
  writeFileSync(dataFile, JSON.stringify(db));
  const nova = await api('POST', '/api/auth/register', { name: 'Outra pessoa', email: antiga.email, password: 'outra-senha' });
  assert.equal(nova.status, 201);
  assert.notEqual(nova.body.user.id, antiga.id);

  const recusado = await api('GET', '/api/auth/me', null, antiga.token);
  assert.equal(recusado.status, 401);
});

test('token antigo, sem versão, continua valendo até o logout (sem derrubar quem já está logado)', async () => {
  const conta = await newBuyer();
  const db = JSON.parse(readFileSync(dataFile, 'utf8'));
  const user = db.users.find((item) => item.id === conta.id);
  const legado = jwt.sign({ sub: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
  assert.equal((await api('GET', '/api/auth/me', null, legado)).status, 200);
});
