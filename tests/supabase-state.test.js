// Estado no Supabase (apps/api/supabase-state.js, ADR-0003). Unitário com fetch falso: prova a URL, o
// método, os cabeçalhos, o corpo e os erros que o módulo monta. NÃO prova que o PostgREST aceita esse
// formato (filtro, Prefer, tipo da chave), RLS/grants nem limite de tamanho: aí o teste só confere o fake.
// No fim, o servidor de verdade: escolha do backend e saída com configuração pela metade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readSupabaseConfig, readSupabaseState, writeSupabaseState } from '../apps/api/supabase-state.js';
import { startServer } from './helpers/start-server.js';

const KEY = 'chave-falsa-teste';
const cfg = /** @type {const} */ ({ mode: 'supabase', url: 'https://projeto.exemplo.invalid', key: KEY, rowId: 'main' });

/** fetch falso: guarda as chamadas e responde com `reply`. */
function fakeFetch(reply) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return reply(url, init);
  };
  return { calls, impl };
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A mensagem de erro não pode levar a chave nem a URL da requisição. */
async function rejectsSafely(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.match(error.message, pattern);
    assert.equal(error.message.includes(KEY), false, 'a chave apareceu na mensagem');
    assert.equal(error.message.includes('projeto.exemplo.invalid'), false, 'a URL apareceu na mensagem');
    assert.equal(error.cause, undefined);
    return true;
  });
}

test('config: sem SUPABASE_* é o arquivo; com as duas, Supabase com a linha main', () => {
  assert.deepEqual(readSupabaseConfig({}), { mode: 'file' });
  assert.deepEqual(readSupabaseConfig({ SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '' }), { mode: 'file' });
  assert.deepEqual(
    readSupabaseConfig({ SUPABASE_URL: 'https://projeto.exemplo.invalid/', SUPABASE_SERVICE_KEY: KEY }),
    { mode: 'supabase', url: 'https://projeto.exemplo.invalid', key: KEY, rowId: 'main' }
  );
});

test('config: DATA_FILE vence sempre, mesmo com as duas ou só uma SUPABASE_*', () => {
  assert.deepEqual(readSupabaseConfig({ DATA_FILE: '/tmp/db.json', SUPABASE_URL: 'https://x.invalid', SUPABASE_SERVICE_KEY: KEY }), { mode: 'file' });
  assert.deepEqual(readSupabaseConfig({ DATA_FILE: '/tmp/db.json', SUPABASE_URL: 'https://x.invalid' }), { mode: 'file' });
});

test('config: só uma das duas é erro que nomeia a que falta, sem mostrar valor', () => {
  const semChave = readSupabaseConfig({ SUPABASE_URL: 'https://projeto.exemplo.invalid' });
  assert.ok('error' in semChave);
  assert.match(semChave.error, /SUPABASE_SERVICE_KEY/);
  assert.equal(semChave.error.includes('projeto.exemplo.invalid'), false);

  const semUrl = readSupabaseConfig({ SUPABASE_SERVICE_KEY: KEY });
  assert.ok('error' in semUrl);
  assert.match(semUrl.error, /SUPABASE_URL/);
  assert.equal(semUrl.error.includes(KEY), false);
});

test('config: URL precisa ser https', () => {
  for (const url of ['http://projeto.exemplo.invalid', 'não é url']) {
    const result = readSupabaseConfig({ SUPABASE_URL: url, SUPABASE_SERVICE_KEY: KEY });
    assert.ok('error' in result, url);
    assert.match(result.error, /https/);
  }
});

test('leitura: GET da linha main só com a coluna data, chave em apikey e Bearer, com timeout', async () => {
  const fake = fakeFetch(() => json(200, [{ data: { users: [] } }]));
  assert.deepEqual(await readSupabaseState(cfg, fake.impl), { users: [] });
  const [{ url, init }] = fake.calls;
  assert.equal(url, 'https://projeto.exemplo.invalid/rest/v1/agrotech_state?id=eq.main&select=data');
  assert.equal(init.method, 'GET');
  assert.equal(init.headers.apikey, KEY);
  assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
  assert.ok(init.signal instanceof AbortSignal);
});

test('leitura: a linha {} inicial volta como {} (o readDb do servidor transforma no seed)', async () => {
  const fake = fakeFetch(() => json(200, [{ data: {} }]));
  assert.deepEqual(await readSupabaseState(cfg, fake.impl), {});
});

test('leitura: conteúdo que não é objeto (array, null) é erro, não vira seed nem apaga o estado', async () => {
  await rejectsSafely(readSupabaseState(cfg, fakeFetch(() => json(200, [{ data: [] }])).impl), /^Supabase: leitura falhou \(conteúdo inválido\)$/);
  await rejectsSafely(readSupabaseState(cfg, fakeFetch(() => json(200, [{ data: null }])).impl), /^Supabase: leitura falhou \(conteúdo inválido\)$/);
});

test('leitura: linha ausente é erro, nunca {} em silêncio', async () => {
  await rejectsSafely(readSupabaseState(cfg, fakeFetch(() => json(200, [])).impl), /^Supabase: leitura falhou \(linhas: 0\)$/);
});

test('gravação: PATCH na linha main com data + updated_at e contagem pela representação', async () => {
  const fake = fakeFetch(() => json(200, [{ id: 'main' }]));
  const before = Date.now();
  await writeSupabaseState(cfg, { users: [{ id: 'u1' }] }, fake.impl);
  const [{ url, init }] = fake.calls;
  assert.equal(url, 'https://projeto.exemplo.invalid/rest/v1/agrotech_state?id=eq.main&select=id');
  assert.equal(init.method, 'PATCH');
  assert.equal(init.headers.Prefer, 'return=representation');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.equal(init.headers.apikey, KEY);
  assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
  assert.ok(init.signal instanceof AbortSignal);
  const body = JSON.parse(init.body);
  assert.deepEqual(body.data, { users: [{ id: 'u1' }] });
  assert.ok(Date.parse(body.updated_at) >= before - 1000, 'updated_at precisa ser o instante da gravação');
});

test('gravação: 0 linhas afetadas é erro (PATCH sem linha responde 200)', async () => {
  await rejectsSafely(writeSupabaseState(cfg, {}, fakeFetch(() => json(200, [])).impl), /^Supabase: gravação falhou \(linhas: 0\)$/);
});

test('erro 5xx leva o status e o code do PostgREST, nunca message/details', async () => {
  const fake = fakeFetch(() => json(503, { code: 'PGRST000', message: `detalhe com ${KEY}`, details: 'x' }));
  await rejectsSafely(writeSupabaseState(cfg, {}, fake.impl), /^Supabase: gravação falhou \(status 503, PGRST000\)$/);
  await rejectsSafely(readSupabaseState(cfg, fakeFetch(() => new Response('pane', { status: 500 })).impl), /^Supabase: leitura falhou \(status 500\)$/);
});

test('falha de rede vira erro próprio, sem cause', async () => {
  const fake = fakeFetch(() => { throw new TypeError('fetch failed', { cause: new Error(`conexão com ${cfg.url}`) }); });
  await rejectsSafely(readSupabaseState(cfg, fake.impl), /^Supabase: leitura falhou \(rede\)$/);
});

test('timeout (chamada pendurada abortada) vira erro de tempo esgotado', async () => {
  const fake = fakeFetch(() => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); });
  await rejectsSafely(writeSupabaseState(cfg, {}, fake.impl), /^Supabase: gravação falhou \(tempo esgotado\)$/);
});

test('resposta 200 que não é JSON é erro', async () => {
  await rejectsSafely(readSupabaseState(cfg, fakeFetch(() => new Response('<html>')).impl), /^Supabase: leitura falhou \(resposta inválida\)$/);
});

test('servidor: com DATA_FILE e SUPABASE_* no ambiente, grava no arquivo e não chama o Supabase', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agrotech-supabase-'));
  const dataFile = path.join(dir, 'db.json');
  // exemplo.invalid não resolve: se o servidor tentasse o Supabase, o cadastro daria 500.
  const server = await startServer({
    env: { DATA_FILE: dataFile, SUPABASE_URL: 'https://exemplo.invalid', SUPABASE_SERVICE_KEY: KEY, JWT_SECRET: 'segredo-teste' }
  });
  try {
    const email = `arquivo-${Date.now()}@agrotech.dev`;
    const res = await fetch(`${server.base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Teste', email, password: 'senha123' })
    });
    assert.equal(res.status, 201);
    assert.ok(readFileSync(dataFile, 'utf8').includes(email));
    assert.match(server.output(), /dados: arquivo/);
    assert.equal(server.output().includes(KEY), false);
  } finally {
    server.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('servidor: modo Supabase fora do ar responde 500 genérico e não vaza a chave no log', async () => {
  const server = await startServer({
    env: { DATA_FILE: undefined, SUPABASE_URL: 'https://exemplo.invalid', SUPABASE_SERVICE_KEY: KEY, JWT_SECRET: 'segredo-teste' }
  });
  try {
    const res = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@agrotech.com.br', password: 'admin123' })
    });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { message: 'Erro ao acessar os dados do servidor.' });
    assert.match(server.output(), /dados: Supabase \(exemplo\.invalid\)/);
    assert.match(server.output(), /Supabase: leitura falhou/);
    assert.equal(server.output().includes(KEY), false, 'a chave apareceu no log');
  } finally {
    server.kill();
  }
});

test('servidor: só uma SUPABASE_* e sem DATA_FILE, sai com erro que nomeia a variável sem o valor', async () => {
  await assert.rejects(
    startServer({ env: { DATA_FILE: undefined, SUPABASE_URL: 'https://exemplo.invalid', JWT_SECRET: 'segredo-teste' } }),
    (error) => {
      assert.match(error.message, /código 1/);
      assert.match(error.message, /SUPABASE_SERVICE_KEY/);
      assert.equal(error.message.includes('exemplo.invalid'), false);
      return true;
    }
  );
});
