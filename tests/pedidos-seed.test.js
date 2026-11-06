// Issue #41: o status e o estágio do rastreio dizem a mesma coisa em todo pedido, inclusive no seed.
// Sobe o server.js de verdade numa porta livre, com banco descartável (DATA_FILE), no molde de
// tests/api.test.js, e confere os pedidos que o seed grava.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TRACKING_STAGES } from '../src/modules/tracker.js';

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
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-seed-'));
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ['server.js'], {
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
  throw new Error('server.js não subiu em 10s');
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

// Status que o seed usa → estágio de TRACKING_STAGES que ele descreve. Status novo no seed exige entrada aqui.
const STAGE_BY_STATUS = { 'Em trânsito': 'Saiu para Entrega' };

test('cada pedido do seed tem statusStep no estágio que o status descreve', async () => {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agrotech.com.br', password: 'admin123' })
  }).then((res) => res.json());
  const orders = await fetch(`${base}/api/orders`, { headers: { Authorization: `Bearer ${login.token}` } }).then((res) => res.json());
  assert.ok(orders.length > 0, 'o seed tem pedidos');
  for (const order of orders) {
    assert.equal(
      TRACKING_STAGES[order.statusStep - 1],
      STAGE_BY_STATUS[order.status],
      `${order.id}: statusStep ${order.statusStep} não bate com "${order.status}"`
    );
  }
});
