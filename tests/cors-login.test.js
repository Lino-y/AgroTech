// CORS com allowlist (CORS_ORIGINS) e limite de tentativas no login (issue #62). As rotas sobem o
// apps/api/server.js de verdade numa porta livre, com banco descartável (DATA_FILE), no molde de
// tests/orders.test.js. O limitador também tem testes unitários com relógio falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAX_FAILURES, WINDOW_MS, blockedSeconds, clearFailures, recordFailure } from '../apps/api/login-limiter.js';
import { startServer as startServerProcess } from './helpers/start-server.js';


/** Sobe o servidor com as variáveis dadas; devolve a base da URL e como desligar. */
async function startServer(extraEnv = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-cors-login-'));
  const started = await startServerProcess({
    env: { DATA_FILE: path.join(dataDir, 'db.json'), JWT_SECRET: '', CORS_ORIGINS: undefined, ...extraEnv }
  });
  const stop = () => {
    started.kill();
    rmSync(dataDir, { recursive: true, force: true });
  };
  return { base: started.base, stop };
}

const post = (base, url, body) => fetch(base + url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

// --- CORS ---

test('CORS: só as origens de CORS_ORIGINS recebem Access-Control-Allow-Origin', async () => {
  const { base, stop } = await startServer({ CORS_ORIGINS: 'https://app.exemplo.com, https://admin.exemplo.com' });
  try {
    const allowed = await fetch(`${base}/api/health`, { headers: { Origin: 'https://admin.exemplo.com' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://admin.exemplo.com');
    const denied = await fetch(`${base}/api/health`, { headers: { Origin: 'https://malicioso.com' } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    // Barra final não casa: a origem é exata.
    const trailing = await fetch(`${base}/api/health`, { headers: { Origin: 'https://app.exemplo.com/' } });
    assert.equal(trailing.headers.get('access-control-allow-origin'), null);
  } finally {
    stop();
  }
});

test('CORS: sem CORS_ORIGINS nenhuma origem externa é liberada, e a mesma origem continua funcionando', async () => {
  const { base, stop } = await startServer();
  try {
    const external = await fetch(`${base}/api/health`, { headers: { Origin: 'https://qualquer.com' } });
    assert.equal(external.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(`${base}/api/health`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://qualquer.com', 'Access-Control-Request-Method': 'GET' }
    });
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  } finally {
    stop();
  }
});

// --- Limitador (apps/api/login-limiter.js), relógio falso ---

test('limitador: bloqueia na 10ª falha por 15 min, contados da primeira falha da janela', () => {
  const store = new Map();
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_FAILURES; i++) {
    assert.equal(blockedSeconds(store, 'a@b.com', t0 + i), 0, `falha ${i}`);
    recordFailure(store, 'a@b.com', t0 + i);
  }
  assert.equal(MAX_FAILURES, 10);
  assert.equal(blockedSeconds(store, 'a@b.com', t0 + 1000), WINDOW_MS / 1000 - 1);
  assert.equal(blockedSeconds(store, 'a@b.com', t0 + WINDOW_MS - 1), 1);
  assert.equal(blockedSeconds(store, 'a@b.com', t0 + WINDOW_MS), 0);
});

test('limitador: 9 falhas não bloqueiam, e outro e-mail não é afetado', () => {
  const store = new Map();
  for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure(store, 'a@b.com', 5000);
  assert.equal(blockedSeconds(store, 'a@b.com', 5001), 0);
  recordFailure(store, 'a@b.com', 5000);
  assert.ok(blockedSeconds(store, 'a@b.com', 5001) > 0);
  assert.equal(blockedSeconds(store, 'c@d.com', 5001), 0);
});

test('limitador: falhas fora da janela de 15 min recomeçam a contagem; sucesso zera', () => {
  const store = new Map();
  for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure(store, 'a@b.com', 0);
  recordFailure(store, 'a@b.com', WINDOW_MS + 1); // janela nova: conta 1, não 10
  assert.equal(blockedSeconds(store, 'a@b.com', WINDOW_MS + 2), 0);
  for (let i = 0; i < MAX_FAILURES; i++) recordFailure(store, 'x@y.com', 0);
  assert.ok(blockedSeconds(store, 'x@y.com', 1) > 0);
  clearFailures(store, 'x@y.com');
  assert.equal(blockedSeconds(store, 'x@y.com', 1), 0);
});

// --- Rota de login ---

test('login: 10 falhas trancam o e-mail (até a senha certa leva 429 com Retry-After); outro e-mail segue livre', async () => {
  const { base, stop } = await startServer();
  try {
    for (const email of ['alvo@exemplo.com', 'outro@exemplo.com']) {
      const signup = await post(base, '/api/auth/register', { name: 'Fulano', email, password: 'senha-certa-123' });
      assert.equal(signup.status, 201);
    }
    for (let i = 0; i < 10; i++) {
      // E-mail normalizado: maiúsculas e espaços contam como o mesmo e-mail.
      const res = await post(base, '/api/auth/login', { email: i % 2 ? '  ALVO@exemplo.com ' : 'alvo@exemplo.com', password: 'errada' });
      assert.equal(res.status, 401, `tentativa ${i + 1}`);
    }
    const blocked = await post(base, '/api/auth/login', { email: 'alvo@exemplo.com', password: 'senha-certa-123' });
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), { message: 'Muitas tentativas de login. Tente de novo em alguns minutos.' });
    const retryAfter = Number(blocked.headers.get('retry-after'));
    assert.ok(retryAfter > 0 && retryAfter <= 900, `Retry-After ${retryAfter}`);

    const other = await post(base, '/api/auth/login', { email: 'outro@exemplo.com', password: 'senha-certa-123' });
    assert.equal(other.status, 200);
  } finally {
    stop();
  }
});

test('login: sucesso zera o contador (9 falhas + acerto + 9 falhas não bloqueiam)', async () => {
  const { base, stop } = await startServer();
  try {
    const email = 'zera@exemplo.com';
    await post(base, '/api/auth/register', { name: 'Fulano', email, password: 'senha-certa-123' });
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 9; i++) {
        assert.equal((await post(base, '/api/auth/login', { email, password: 'errada' })).status, 401);
      }
      assert.equal((await post(base, '/api/auth/login', { email, password: 'senha-certa-123' })).status, 200);
    }
  } finally {
    stop();
  }
});
