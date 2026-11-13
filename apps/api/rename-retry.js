// Troca atômica do db.json (writeDb) que aguenta o Windows: lá o rename por cima de um arquivo aberto por
// outro leitor falha com EPERM/EBUSY/EACCES por alguns milissegundos. Sem a nova tentativa, a gravação
// falhava quando uma leitura caía no mesmo instante (achado no webhook do Mercado Pago, issue #91).
// No Linux o rename substitui o arquivo mesmo aberto e passa de primeira.

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);
const ATTEMPTS = 10;

/**
 * @param {(from: string, to: string) => Promise<void>} rename fs.promises.rename (injetável no teste)
 * @param {string} from
 * @param {string} to
 * @param {(ms: number) => Promise<void>} [wait]
 */
export async function renameWithRetry(rename, from, to, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (error) {
      if (!RETRYABLE.has(error?.code) || attempt >= ATTEMPTS) throw error;
      await wait(attempt * 20);
    }
  }
}
