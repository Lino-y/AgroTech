// Base dos testes de tela (`npm run test:ui`, fora do `npm test`): sobe o server.js com banco
// descartável (DATA_FILE) e dirige o Chrome headless pelo DevTools Protocol, sem dependência
// nova (WebSocket e fetch são nativos no Node 22). Sem Chrome ou Edge na máquina, os testes pulam.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// CHROME_PATH, quando definido, é o único candidato: caminho errado pula os testes em vez de abrir outro navegador.
const BROWSERS = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge'
];
const browserPath = BROWSERS.find((file) => file && existsSync(file));

/** Motivo para pular os testes de tela; `false` quando há navegador. */
export const skipReason = browserPath ? false : 'Chrome ou Edge não encontrado: instale um deles ou aponte CHROME_PATH para o executável';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

// Repete `check` até dar verdadeiro. Erro no meio (servidor subindo, aba trocando de documento) conta como "ainda não".
async function poll(check, what, timeout = 5000) {
  let lastError;
  for (const end = Date.now() + timeout; Date.now() < end; await sleep(50)) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Tempo esgotado esperando ${what}${lastError ? ` (${lastError.message})` : ''}`);
}

// Uma conexão com o navegador; cada aba conversa por ela com o próprio sessionId.
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) {
      listeners.forEach((listener) => listener(message));
      return;
    }
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  ws.addEventListener('close', () => pending.forEach((reply) => reply({ error: { message: 'conexão com o navegador fechou' } })));
  const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, ({ result, error }) => (error ? reject(new Error(`${method}: ${error.message}`)) : resolve(result)));
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  return { send, listeners, close: () => ws.close() };
}

// GET /api/products: sem `products`, vai ao server.js; com { status?, body }, a aba recebe essa
// resposta; com 'offline', a requisição falha como sem internet.
function answerProducts(page, requestId) {
  const reply = page.products;
  if (!reply) return page.send('Fetch.continueRequest', { requestId });
  if (reply === 'offline') return page.send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' });
  return page.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: reply.status ?? 200,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify(reply.body)).toString('base64')
  });
}

// Abre a SPA numa aba com perfil próprio (localStorage limpo), em viewport de celular se não
// vier outro, e espera a 1ª carga do catálogo. `page.products` (ver answerProducts) pode mudar
// no meio do teste.
async function openPage(cdp, url, { products, width = 390, height = 844 } = {}) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext');
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const page = {
    send,
    products,
    navigations: [], // navegações que a própria página pediu (reload, link, envio de form): numa SPA, nenhuma
    errors: [], // exceções não tratadas na página
    async evaluate(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    },
    waitFor: (expression, timeout) => poll(() => page.evaluate(expression), expression, timeout),
    close() {
      cdp.listeners.delete(listener);
      return cdp.send('Target.disposeBrowserContext', { browserContextId });
    }
  };
  const listener = ({ sessionId: from, method, params }) => {
    if (from !== sessionId) return;
    // O id do frame principal é o da aba. O evento chega antes do fim do clique que pediu a navegação.
    if (method === 'Page.frameRequestedNavigation' && params.frameId === targetId) page.navigations.push(params.reason);
    if (method === 'Runtime.exceptionThrown') page.errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === 'Fetch.requestPaused') answerProducts(page, params.requestId).catch((error) => page.errors.push(error.message));
  };
  cdp.listeners.add(listener);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/products' }] });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await page.waitFor('window.state && !state.loadingProducts');
  return page;
}

/** Sobe o server.js e o navegador; `open(opções)` abre a SPA numa aba isolada. */
export async function startApp() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'agrotech-ui-'));
  const appPort = await freePort();
  const cdpPort = await freePort();
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(appPort), DATA_FILE: path.join(tmp, 'db.json'), JWT_SECRET: '' },
    stdio: 'ignore'
  });
  const browser = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    // Só localhost resolve: fonte e foto da internet não atrasam nem derrubam o teste.
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp;
  const close = async () => {
    await cdp?.send('Browser.close').catch(() => {});
    cdp?.close();
    server.kill();
    if (browser.exitCode === null) await Promise.race([once(browser, 'exit'), sleep(3000)]);
    browser.kill();
    try {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // perfil ainda travado pelo navegador no Windows: sobra lixo só no %TEMP%, fora do repositório
    }
  };
  try {
    const url = `http://localhost:${appPort}/`;
    await poll(async () => (await fetch(`${url}api/health`)).ok, 'o server.js subir', 10000);
    const version = await poll(async () => (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json(), 'a porta de depuração do navegador', 10000);
    cdp = await connect(version.webSocketDebuggerUrl);
    return { open: (options) => openPage(cdp, url, options), close };
  } catch (error) {
    await close();
    throw error;
  }
}
