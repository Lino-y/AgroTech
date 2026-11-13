// Sobe apps/api/server.js para os testes de API e de tela. O servidor pede ao sistema uma porta livre
// (PORT=0) no próprio listen e escreve a porta real no log; o helper lê essa linha. Assim não há janela
// entre "escolher a porta" e "escutar", em que outro teste pudesse pegá-la. "Pronto" é essa linha do
// próprio processo, e não uma resposta HTTP, que poderia ser de outro servidor.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SERVER_FILE = fileURLToPath(new URL('../../apps/api/server.js', import.meta.url));
const READY = /AgroTech backend running on http:\/\/localhost:(\d+)/;

/**
 * Porta livre no momento da escolha. Só para o que não é o servidor da API (ex.: a porta de depuração do
 * navegador nos testes de tela): para o servidor, use startServer, que não escolhe porta.
 * @returns {Promise<number>}
 */
export const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

/**
 * Sobe o servidor. Uma variável com valor `undefined` em `env` sai do ambiente do processo (o Node omite
 * essa chave), mesmo que o processo de teste a tenha.
 * @param {{ env?: Record<string, string | undefined> }} [options]
 * @returns {Promise<{ base: string, child: import('node:child_process').ChildProcess, kill: () => void, output: () => string }>}
 */
export function startServer({ env = {} } = {}) {
  // cwd numa pasta temporária: o server.js lê o .env da pasta atual (dotenv), e o .env de quem roda os
  // testes (credenciais reais do Mercado Pago, JWT_SECRET) não pode mudar o resultado. Os caminhos do
  // servidor saem do próprio arquivo, não da pasta atual.
  const child = spawn(process.execPath, [SERVER_FILE], {
    cwd: tmpdir(),
    env: { ...process.env, ...env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stderr.resume();
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('apps/api/server.js não avisou que subiu em 10 s'));
    }, 10_000);
    const check = () => {
      const found = READY.exec(output);
      if (!found) return;
      clearTimeout(timer);
      resolve({ base: `http://localhost:${found[1]}`, child, kill: () => child.kill(), output: () => output });
    };
    child.stdout.on('data', check);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`apps/api/server.js saiu antes de subir (código ${code}): ${output.trim()}`));
    });
  });
}
