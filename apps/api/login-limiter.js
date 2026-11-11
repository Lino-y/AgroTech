// @ts-check

// Limite de tentativas de login: 10 falhas de senha por e-mail numa janela de 15 minutos trancam o
// e-mail até a janela acabar (a janela começa na primeira falha). Login certo zera a contagem.
//
// Teto conhecido (ponytail):
// - O estado fica em memória, por processo: zera ao reiniciar o servidor e, com mais de uma
//   instância, cada uma conta sozinha (o limite real vira 10 x instâncias). Para escalar, o Map
//   precisa virar armazenamento compartilhado (ex.: Redis com expiração).
// - A chave é só o e-mail normalizado, então quem conhece o e-mail de outra pessoa consegue
//   trancá-la por 15 minutos errando a senha de propósito. Chavear também por IP não resolve (o
//   atacante troca de IP) e foi deixado de fora; fica registrado, não resolvido.
//
// Funções puras sobre um Map recebido por parâmetro, com o relógio (`now`, em ms) também por
// parâmetro, para testar sem esperar.

export const MAX_FAILURES = 10;
export const WINDOW_MS = 15 * 60 * 1000;
// Acima disto, cada falha varre as entradas vencidas: o Map não cresce sem limite com e-mails inventados.
const SWEEP_ABOVE = 5000;

/** @typedef {Map<string, { count: number, start: number }>} FailureStore */

/**
 * Segundos que faltam para o e-mail destrancar; 0 se ele pode tentar.
 * @param {FailureStore} store
 * @param {string} key e-mail já normalizado (trim + minúsculas)
 * @param {number} now relógio em ms
 * @returns {number}
 */
export function blockedSeconds(store, key, now) {
  const entry = store.get(key);
  if (!entry || entry.count < MAX_FAILURES || now - entry.start >= WINDOW_MS) return 0;
  return Math.ceil((entry.start + WINDOW_MS - now) / 1000);
}

/**
 * Registra uma falha de senha; a janela anterior vencida recomeça a contagem.
 * @param {FailureStore} store
 * @param {string} key e-mail já normalizado
 * @param {number} now relógio em ms
 * @returns {void}
 */
export function recordFailure(store, key, now) {
  if (store.size > SWEEP_ABOVE) {
    for (const [k, entry] of store) if (now - entry.start >= WINDOW_MS) store.delete(k);
  }
  const entry = store.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) store.set(key, { count: 1, start: now });
  else entry.count += 1;
}

/**
 * Zera a contagem do e-mail (login bem-sucedido).
 * @param {FailureStore} store
 * @param {string} key e-mail já normalizado
 * @returns {void}
 */
export function clearFailures(store, key) {
  store.delete(key);
}
