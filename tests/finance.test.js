// Financeiro (issue #6): regras do extrato, carga da tela e rotas da API. As rotas sobem o
// server.js de verdade numa porta livre, com banco descartável (DATA_FILE), no mesmo molde
// de tests/api.test.js, sem tocar no src/data/db.json do repositório.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildFinanceEntries, summarizeFinance } from '../src/services/finance.js';
import { syncFinance } from '../src/modules/finance-sync.js';
import { createFinanceEntry, loadFinanceEntries } from '../src/services/api.js';

const sum = (list, field) => list.reduce((total, item) => total + item[field], 0);
const ids = (list) => list.map((entry) => entry.id);
// Data local ao meio-dia, em ISO, como o servidor grava o createdAt.
const at = (year, month, day) => new Date(year, month - 1, day, 12).toISOString();
const now = new Date(2026, 9, 20, 12); // 20/out/2026

// --- Regras do extrato (src/services/finance.js) ---

test('financeiro vazio: totais zerados e gráfico com os meses do período', () => {
  const { chart, ...totals } = summarizeFinance([], { now });
  assert.deepEqual(totals, { income: 0, expense: 0, balance: 0, entries: [], purchases: { count: 0, total: 0 } });
  assert.deepEqual(chart.map(({ month, income, expense }) => [month, income, expense]), [
    ['Mai', 0, 0], ['Jun', 0, 0], ['Jul', 0, 0], ['Ago', 0, 0], ['Set', 0, 0], ['Out', 0, 0]
  ]);
  // Resposta fora do formato não quebra a tela.
  assert.equal(summarizeFinance(undefined, { now }).balance, 0);
  // Conta sem pedido nem lançamento tem extrato vazio.
  assert.deepEqual(buildFinanceEntries({ orders: [], financeEntries: [] }, 'nova@agrotech.dev'), []);
});

test('receita: a venda é o item do vendedor no pedido de outra conta, e entra nos totais', () => {
  const orders = [
    {
      id: 'AGT-1', ownerEmail: 'comprador@agrotech.dev', total: 535, createdAt: at(2026, 10, 3),
      items: [
        { ownerEmail: 'vendedor@agrotech.dev', price: 150, quantity: 2 },
        { ownerEmail: 'outro@agrotech.dev', price: 200, quantity: 1 }
      ]
    },
    // Comprar o próprio produto é compra, não venda.
    {
      id: 'AGT-2', ownerEmail: 'vendedor@agrotech.dev', total: 185, createdAt: at(2026, 10, 4),
      items: [{ ownerEmail: 'vendedor@agrotech.dev', price: 150, quantity: 1 }]
    }
  ];

  const entries = buildFinanceEntries({ orders }, 'vendedor@agrotech.dev');
  assert.deepEqual(entries, [
    { id: 'compra-AGT-2', type: 'EXPENSE', source: 'COMPRA', title: 'Compra no App (AGT-2)', amount: 185, date: at(2026, 10, 4) },
    { id: 'venda-AGT-1', type: 'INCOME', source: 'VENDA', title: 'Venda no App (AGT-1)', amount: 300, date: at(2026, 10, 3) }
  ]);
  const { income, expense, balance } = summarizeFinance(entries, { now });
  assert.deepEqual({ income, expense, balance }, { income: 300, expense: 185, balance: 115 });
});

test('filtro: o período recorta cards, gráfico e extrato; o tipo recorta o extrato; as somas batem', () => {
  const entries = [
    { id: 'soja', type: 'INCOME', source: 'MANUAL', title: 'Venda de soja', amount: 1000, date: at(2026, 10, 2) },
    { id: 'compra-AGT-1', type: 'EXPENSE', source: 'COMPRA', title: 'Compra no App (AGT-1)', amount: 250, date: at(2026, 10, 1) },
    { id: 'venda-AGT-2', type: 'INCOME', source: 'VENDA', title: 'Venda no App (AGT-2)', amount: 400, date: at(2026, 8, 31) },
    // Limite da janela de 6 meses: 1º de maio entra, 30 de abril fica de fora.
    { id: 'compra-AGT-3', type: 'EXPENSE', source: 'COMPRA', title: 'Compra no App (AGT-3)', amount: 100, date: at(2026, 5, 1) },
    { id: 'diesel', type: 'EXPENSE', source: 'MANUAL', title: 'Diesel', amount: 999, date: at(2026, 4, 30) },
    { id: 'compra-AGT-4', type: 'EXPENSE', source: 'COMPRA', title: 'Pedido antigo sem data', amount: 999, date: null }
  ];

  const month = summarizeFinance(entries, { months: 1, now });
  assert.deepEqual([month.income, month.expense, month.balance], [1000, 250, 750]);
  assert.deepEqual(ids(month.entries), ['soja', 'compra-AGT-1']);
  assert.deepEqual(month.chart.map((bucket) => bucket.month), ['Out']);
  assert.deepEqual(month.purchases, { count: 1, total: 250 });

  const quarter = summarizeFinance(entries, { months: 3, now });
  assert.deepEqual([quarter.income, quarter.expense, quarter.balance], [1400, 250, 1150]);

  const half = summarizeFinance(entries, { months: 6, now });
  assert.deepEqual([half.income, half.expense, half.balance], [1400, 350, 1050]);
  assert.deepEqual(ids(half.entries), ['soja', 'compra-AGT-1', 'venda-AGT-2', 'compra-AGT-3']);
  assert.deepEqual(half.purchases, { count: 2, total: 350 });

  // Totais e gráfico da mesma fonte: a soma das barras é o card, em todo período.
  for (const summary of [month, quarter, half]) {
    assert.equal(sum(summary.chart, 'income'), summary.income);
    assert.equal(sum(summary.chart, 'expense'), summary.expense);
  }

  // O tipo recorta só o extrato, que soma o card do mesmo tipo; cards e gráfico seguem o período.
  const incomeOnly = summarizeFinance(entries, { months: 6, type: 'INCOME', now });
  assert.deepEqual(ids(incomeOnly.entries), ['soja', 'venda-AGT-2']);
  assert.equal(sum(incomeOnly.entries, 'amount'), incomeOnly.income);
  const expenseOnly = summarizeFinance(entries, { months: 6, type: 'EXPENSE', now });
  assert.equal(sum(expenseOnly.entries, 'amount'), expenseOnly.expense);
  assert.deepEqual([expenseOnly.income, expenseOnly.expense, expenseOnly.chart], [half.income, half.expense, half.chart]);
});

test('extrato da conta: só os pedidos e lançamentos dela, do mais recente ao mais antigo', () => {
  const orders = [
    // Pedido do seed: só tem a data legível.
    { id: 'AGT-84920', ownerEmail: 'demo@agrotech.com.br', date: '15/Set/2026', total: 329.8, items: [{ name: 'Ração', quantity: 2, price: 89.9 }] },
    // Pedido antigo gravado com "Hoje": não tem data real.
    { id: 'AGT-2', ownerEmail: 'demo@agrotech.com.br', date: 'Hoje', total: 50, items: [] },
    {
      id: 'AGT-3', ownerEmail: 'outra@agrotech.dev', createdAt: at(2026, 10, 5), total: 105,
      items: [{ ownerEmail: 'terceiro@agrotech.dev', price: 70, quantity: 1 }]
    }
  ];
  const financeEntries = [
    { id: 'lan-1', ownerEmail: 'demo@agrotech.com.br', type: 'INCOME', title: 'Venda de soja', amount: 1000, createdAt: at(2026, 10, 2) },
    { id: 'lan-2', ownerEmail: 'outra@agrotech.dev', type: 'EXPENSE', title: 'Diesel', amount: 300, createdAt: at(2026, 10, 3) }
  ];

  assert.deepEqual(buildFinanceEntries({ orders, financeEntries }, 'demo@agrotech.com.br'), [
    { id: 'lan-1', type: 'INCOME', source: 'MANUAL', title: 'Venda de soja', amount: 1000, date: at(2026, 10, 2) },
    { id: 'compra-AGT-84920', type: 'EXPENSE', source: 'COMPRA', title: 'Compra no App (AGT-84920)', amount: 329.8, date: '2026-09-15T12:00:00.000Z' },
    { id: 'compra-AGT-2', type: 'EXPENSE', source: 'COMPRA', title: 'Compra no App (AGT-2)', amount: 50, date: null }
  ]);
});

// --- Carga da tela (src/modules/finance-sync.js) ---

test('carga do financeiro: "carregando" sem lançamento antigo, depois o extrato do servidor', async () => {
  const state = { finance: { entries: [{ id: 'lancamento-anterior' }], loading: false, error: null } };
  const renders = [];
  let respond;
  const done = syncFinance(state, {
    load: () => new Promise((resolve) => { respond = resolve; }),
    render: () => renders.push(structuredClone(state.finance))
  });
  assert.deepEqual(renders, [{ entries: [], loading: true, error: null }]);
  respond([{ id: 'compra-AGT-1' }]);
  await done;
  assert.deepEqual(renders.at(-1), { entries: [{ id: 'compra-AGT-1' }], loading: false, error: null });
});

test('falha na carga do financeiro vira aviso na tela, sem lançamento', async () => {
  const state = { finance: { entries: [], loading: false, error: null } };
  await syncFinance(state, { load: () => Promise.reject(new Error('Sem conexão com o servidor.')), render() {} });
  assert.deepEqual(state.finance, { entries: [], loading: false, error: 'Sem conexão com o servidor.' });
  // Sem mensagem, a tela ficaria sem aviso nenhum.
  await syncFinance(state, { load: () => Promise.reject(new Error('')), render() {} });
  assert.equal(state.finance.error, 'Não foi possível carregar o financeiro.');
});

test('resposta atrasada de uma carga anterior não sobrescreve o extrato atual (troca de conta)', async () => {
  const state = { finance: { entries: [], loading: false, error: null } };
  let respondOld;
  const old = syncFinance(state, { load: () => new Promise((resolve) => { respondOld = resolve; }), render() {} });
  await syncFinance(state, { load: async () => [{ id: 'da-conta-nova' }], render() {} });
  respondOld([{ id: 'da-conta-anterior' }]);
  await old;
  assert.deepEqual(state.finance, { entries: [{ id: 'da-conta-nova' }], loading: false, error: null });
});

test('as funções da API do financeiro chamam as rotas que o server.js declara', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('[]', { status: 200 }));
  await loadFinanceEntries();
  await createFinanceEntry({ title: 'Diesel', amount: 300, type: 'EXPENSE' });
  assert.deepEqual(
    fetchMock.mock.calls.map(({ arguments: [url, options] }) => `${options.method || 'GET'} ${url}`),
    ['GET /api/finance/entries', 'POST /api/finance/entries']
  );
  assert.deepEqual(JSON.parse(fetchMock.mock.calls[1].arguments[1].body), { title: 'Diesel', amount: 300, type: 'EXPENSE' });
});

// --- Rotas da API (server.js) ---

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
  dataDir = mkdtempSync(path.join(tmpdir(), 'agrotech-finance-'));
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

async function api(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let seq = 0;
async function newUser(extra = {}) {
  const email = `financeiro${++seq}-${Date.now()}@agrotech.dev`;
  const res = await api('POST', '/api/auth/register', { name: 'Teste', email, password: 'senha123', ...extra });
  return { email, token: res.body?.token };
}

test('compra aprovada entra no extrato do comprador (saída) e do vendedor (entrada); outra conta vê vazio', async () => {
  const seller = await newUser({ role: 'VENDEDOR' });
  const buyer = await newUser();
  const other = await newUser();
  const product = (await api('POST', '/api/products', { name: 'Milho', price: 150, category: 'Grãos', description: 'lote' }, seller.token)).body;
  const order = await api('POST', '/api/orders', { items: [{ id: product.id, quantity: 2 }] }, buyer.token);
  assert.equal(order.status, 201);
  assert.ok(!Number.isNaN(Date.parse(order.body.createdAt)), 'pedido novo grava a data real');

  const ofBuyer = await api('GET', '/api/finance/entries', null, buyer.token);
  assert.equal(ofBuyer.status, 200);
  assert.deepEqual(ofBuyer.body, [
    { id: `compra-${order.body.id}`, type: 'EXPENSE', source: 'COMPRA', title: `Compra no App (${order.body.id})`, amount: order.body.total, date: order.body.createdAt }
  ]);
  assert.deepEqual((await api('GET', '/api/finance/entries', null, seller.token)).body, [
    { id: `venda-${order.body.id}`, type: 'INCOME', source: 'VENDA', title: `Venda no App (${order.body.id})`, amount: 300, date: order.body.createdAt }
  ]);
  assert.deepEqual((await api('GET', '/api/finance/entries', null, other.token)).body, []);
  assert.equal((await api('GET', '/api/finance/entries')).status, 401);
});

test('lançamento manual fica gravado, sobrevive a outra gravação no banco e só a conta dona vê', async () => {
  const owner = await newUser();
  const other = await newUser();
  const created = await api('POST', '/api/finance/entries', { title: 'Venda de <b>soja</b>', amount: 1200.5, type: 'INCOME' }, owner.token);
  assert.equal(created.status, 201);
  assert.equal(created.body.source, 'MANUAL');
  assert.equal(created.body.title, 'Venda de &lt;b&gt;soja&lt;/b&gt;');
  assert.equal(created.body.amount, 1200.5);

  // Um pedido relê e regrava o banco inteiro: o lançamento tem que continuar lá.
  assert.equal((await api('POST', '/api/orders', { items: [{ id: '1', quantity: 1 }] }, owner.token)).status, 201);
  const entries = (await api('GET', '/api/finance/entries', null, owner.token)).body;
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.find((entry) => entry.id === created.body.id), created.body);
  assert.deepEqual((await api('GET', '/api/finance/entries', null, other.token)).body, []);
});

test('lançamento manual inválido é recusado', async () => {
  const { token } = await newUser();
  const invalid = [
    { amount: 10, type: 'INCOME' },
    { title: '   ', amount: 10, type: 'INCOME' },
    { title: 'Diesel', amount: 0, type: 'EXPENSE' },
    { title: 'Diesel', amount: -5, type: 'EXPENSE' },
    { title: 'Diesel', amount: 'abc', type: 'EXPENSE' },
    { title: 'Diesel', amount: 10, type: 'TRANSFERENCIA' }
  ];
  for (const body of invalid) {
    const res = await api('POST', '/api/finance/entries', body, token);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok(res.body.message);
  }
  assert.deepEqual((await api('GET', '/api/finance/entries', null, token)).body, []);
  assert.equal((await api('POST', '/api/finance/entries', { title: 'Diesel', amount: 10, type: 'EXPENSE' })).status, 401);
});
