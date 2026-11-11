// Revisão de segurança: o banco mora em src/data, que fica dentro da pasta servida como estática.
// O bloqueio comparava o caminho sem decodificar, então /src/%64ata/db.json devolvia o banco inteiro
// (usuários e hashes de senha). Este teste usa um arquivo de banco de verdade dentro de src/data.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import path from 'node:path';

const DATA_DIR = path.resolve('src/data');
const FILE = `guard-${process.pid}.json`;
const dirExisted = existsSync(DATA_DIR);
let server;
let port;

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port: free } = probe.address();
    probe.close(() => resolve(free));
  });
});

// Caminho cru, sem a normalização que o fetch faz (ele resolveria %2e e ..).
const raw = (rawPath) => new Promise((resolve, reject) => {
  const req = request({ host: 'localhost', port, path: rawPath, method: 'GET' }, (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.end();
});

before(async () => {
  port = await freePort();
  server = spawn(process.execPath, ['apps/api/server.js'], {
    env: { ...process.env, PORT: String(port), DATA_FILE: path.join(DATA_DIR, FILE), JWT_SECRET: '' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      // /api/products lê o banco e o cria em src/data na primeira chamada.
      if ((await raw('/api/products')).status === 200) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server.js não subiu em 10s');
});

after(() => {
  server?.kill();
  for (const name of existsSync(DATA_DIR) ? readdirSync(DATA_DIR) : []) {
    if (name.startsWith(`guard-${process.pid}`)) rmSync(path.join(DATA_DIR, name), { force: true });
  }
  if (!dirExisted) {
    try {
      rmdirSync(DATA_DIR);
    } catch {
      // sobrou arquivo de outro processo: deixa a pasta
    }
  }
});

test('o banco em src/data não sai pela pasta estática, por nenhum jeito de escrever o caminho', async () => {
  const variants = [
    `/src/data/${FILE}`,
    `/src/%64ata/${FILE}`,
    `/src/DATA/${FILE}`,
    `/src/Data/${FILE}`,
    `/src/data%2F${FILE}`,
    `/src/%2e/data/${FILE}`,
    `/src/%2E%2E/src/data/${FILE}`,
    `/src/%5cdata/${FILE}`,
    `/src/data/%2e/${FILE}`
  ];
  for (const variant of variants) {
    const { status, body } = await raw(variant);
    assert.equal(body.includes('"users"'), false, `${variant} devolveu o banco (${status})`);
    assert.notEqual(status, 200, `${variant} respondeu 200`);
  }
});

test('o resto da pasta estática continua servido', async () => {
  const { status, body } = await raw('/src/styles/tokens.css');
  assert.equal(status, 200);
  assert.match(body, /:root/);
});

test('/packages/domain serve o domínio e nada além dele', async () => {
  const domain = await raw('/packages/domain/commerce.js');
  assert.equal(domain.status, 200);
  assert.match(domain.body, /export function calculateCartSummary/);
  const outside = [
    '/packages/domain/../../server.js',
    '/packages/domain/%2e%2e/%2e%2e/server.js',
    '/packages/domain/..%2f..%2fpackage.json',
    '/packages/server.js'
  ];
  for (const variant of outside) {
    const { body } = await raw(variant);
    assert.equal(/from 'express'|"dependencies"/.test(body), false, `${variant} devolveu arquivo fora do domínio`);
  }
});
