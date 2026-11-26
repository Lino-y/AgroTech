// @ts-check
// Estado do AgroTech numa linha jsonb do Supabase (ADR-0003): o documento inteiro do db.json fica em
// `agrotech_state.data`, lido e gravado pela API REST (PostgREST) com a chave service_role, só no servidor.
// fetch nativo, sem `pg` nem `@supabase/supabase-js`. Mensagem de erro nunca leva URL com query,
// cabeçalho nem corpo: só a operação, o status e, no máximo, o `code` do PostgREST.

// Um fetch pendurado seguraria a vez na fila de escrita e travaria toda gravação.
const TIMEOUT_MS = 10_000;

/**
 * @typedef {{ mode: 'supabase', url: string, key: string, rowId: string }} SupabaseConfig
 */

/**
 * Escolhe onde mora o estado. `DATA_FILE` vence sempre (testes e banco descartável). Sem as duas
 * SUPABASE_*, é o arquivo, como antes. Só uma delas é erro, para não subir no backend errado.
 * @param {Record<string, string | undefined>} env
 * @returns {{ mode: 'file' } | SupabaseConfig | { error: string }}
 */
export function readSupabaseConfig(env) {
  if (env.DATA_FILE) return { mode: 'file' };
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  if (!names.some((name) => env[name])) return { mode: 'file' };
  const missing = names.filter((name) => !env[name]);
  if (missing.length) {
    return { error: `Supabase configurado pela metade: falta ${missing.join(', ')}. Preencha as duas ou remova as duas (dados no arquivo).` };
  }
  let url;
  try {
    url = new URL(String(env.SUPABASE_URL));
  } catch {
    return { error: 'SUPABASE_URL precisa ser um endereço https://.' };
  }
  if (url.protocol !== 'https:') return { error: 'SUPABASE_URL precisa ser um endereço https://.' };
  return {
    mode: 'supabase',
    url: `${url.origin}${url.pathname}`.replace(/\/+$/, ''),
    key: String(env.SUPABASE_SERVICE_KEY),
    rowId: 'main'
  };
}

/**
 * Lê o documento cru da linha. Linha ausente é erro: ela é provisionada, e a falta indica configuração
 * errada (nunca devolve `{}` em silêncio).
 * @param {SupabaseConfig} cfg
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Record<string, any>>}
 */
export async function readSupabaseState(cfg, fetchImpl = fetch) {
  const [row] = await requestOneRow(cfg, 'leitura', 'select=data', { method: 'GET' }, fetchImpl);
  if (!row || typeof row.data !== 'object' || row.data === null) throw new Error('Supabase: leitura falhou (conteúdo inválido)');
  return row.data;
}

/**
 * Grava o documento inteiro num só UPDATE (tudo ou nada). PATCH em vez de upsert: a linha apagada não é
 * recriada em silêncio. `updated_at` vai no corpo porque o `default now()` só vale no INSERT.
 * @param {SupabaseConfig} cfg
 * @param {unknown} data
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<void>}
 */
export async function writeSupabaseState(cfg, data, fetchImpl = fetch) {
  await requestOneRow(cfg, 'gravação', 'select=id', {
    method: 'PATCH',
    // return=representation + select=id: volta só o id da linha afetada (não o documento) para contar.
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() })
  }, fetchImpl);
}

/**
 * Faz a chamada e exige exatamente uma linha na resposta (PATCH com 0 linhas responde 200 sem erro).
 * @param {SupabaseConfig} cfg
 * @param {string} operation
 * @param {string} select
 * @param {{ method: string, headers?: Record<string, string>, body?: string }} init
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<any[]>}
 */
async function requestOneRow(cfg, operation, select, init, fetchImpl) {
  const fail = (/** @type {string} */ detail) => new Error(`Supabase: ${operation} falhou (${detail})`);
  const endpoint = `${cfg.url}/rest/v1/agrotech_state?id=eq.${encodeURIComponent(cfg.rowId)}&${select}`;
  let response;
  let rows;
  try {
    response = await fetchImpl(endpoint, {
      ...init,
      headers: { ...init.headers, apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) throw fail(`status ${response.status}${await postgrestCode(response)}`);
    rows = await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Supabase:')) throw error;
    // Sem `cause`: o erro do fetch do Node pode carregar detalhes da requisição.
    const name = error instanceof Error ? error.name : '';
    throw fail(name === 'TimeoutError' || name === 'AbortError' ? 'tempo esgotado' : response ? 'resposta inválida' : 'rede');
  }
  if (!Array.isArray(rows) || rows.length !== 1) throw fail(`linhas: ${Array.isArray(rows) ? rows.length : 'nenhuma'}`);
  return rows;
}

/**
 * `code` do erro do PostgREST (ex.: PGRST116, 42501), só se tiver cara de código: o resto do corpo
 * (message, details, hint) pode repetir dado da requisição.
 * @param {Response} response
 */
async function postgrestCode(response) {
  try {
    const body = await response.json();
    return typeof body?.code === 'string' && /^[A-Z0-9]{1,10}$/i.test(body.code) ? `, ${body.code}` : '';
  } catch {
    return '';
  }
}
