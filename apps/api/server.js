import express from 'express';
import cors from 'cors';
import { blockedSeconds, clearFailures, recordFailure } from './login-limiter.js';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { getProductCategoryStyle } from '../../packages/domain/catalog.js';
import { calculateCartSummary, validatePassword } from '../../packages/domain/commerce.js';
import { buildFinanceEntries } from '../../packages/domain/finance.js';
import { countsAsSale, MAX_FEE_PERCENT, PAYMENT_STATUS } from '../../packages/domain/payments.js';
import { createTurnQueue } from './write-queue.js';
import { renameWithRetry } from './rename-retry.js';
import { MercadoPagoError, readMercadoPagoConfig, verifyWebhookSignature } from './mercadopago.js';
import {
  completeSellerConnection, PaymentFlowError, preparePayment, processNotification, startSellerConnection,
  sweepPayments, syncOrder
} from './payments.js';
import { isBelowMinVersion, readAppMinVersion, readLatestVersion } from './app-version.js';
import { newOrderId, newProductId, newReviewId, newTrackingCode, newUserId } from './ids.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// A SPA (src/, assets/, index.html) e o domínio ainda moram na raiz do repositório (ADR-0002, A2).
const ROOT = path.resolve(__dirname, '..', '..');
const app = express();

// ponytail: Express 4 não captura rejeição de handler async. Sem isto, um erro de banco vira promise
// rejeitada sem resposta e derruba o processo. Todo handler passa por aqui e o erro vai para o
// tratador de erro (500). Teto: Express 5 faz isso sozinho; a troca de versão pede pedido explícito.
const catchAsync = (handler) => (req, res, next) => {
  try {
    Promise.resolve(handler(req, res, next)).catch(next);
  } catch (error) {
    next(error);
  }
};
for (const method of ['get', 'post', 'put', 'delete']) {
  const register = app[method].bind(app);
  app[method] = (route, ...handlers) => (handlers.length ? register(route, ...handlers.map(catchAsync)) : register(route));
}

const writeQueue = createTurnQueue();

const PORT = Number(process.env.PORT || 3001);
// Sem JWT_SECRET, segredo aleatório por processo — nunca um valor fixo no código, que está
// no GitHub e deixaria qualquer um forjar token de admin. Custo: o login cai a cada reinício.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[agrotech] JWT_SECRET ausente: usando segredo aleatório (o login cai a cada reinício). Defina-o no .env.');
}
// Versão mínima do app (GET /api/app-config). Valor inválido derruba a subida: uma versão
// mínima errada que desligasse a checagem em silêncio seria falha silenciosa.
const appMinVersion = readAppMinVersion(process.env.APP_MIN_VERSION);
if ('error' in appMinVersion) {
  console.error(`[agrotech] ${appMinVersion.error}`);
  process.exit(1);
}
const APP_MIN_VERSION = appMinVersion.version;
// Pagamento pelo Mercado Pago (spec 10). Sem nenhuma variável MP_*, o modo é o simulado de hoje (MP fica
// null). Configuração pela metade derruba a subida, como a versão mínima acima.
const mercadoPagoConfig = readMercadoPagoConfig(process.env);
if ('error' in mercadoPagoConfig) {
  console.error(`[agrotech] ${mercadoPagoConfig.error}`);
  process.exit(1);
}
const MP = mercadoPagoConfig.mode === 'mercadopago' ? mercadoPagoConfig : null;
if (MP && !/^https:\/\/(?!localhost|127\.|0\.0\.0\.0)/.test(MP.appUrl)) {
  console.warn('[agrotech] APP_URL não é https público: o Mercado Pago não manda notificação nem volta sozinho, e a volta da web sai em http. Só para teste.');
}
// Versão mais nova para baixar e o APK dela (APP_LATEST_VERSION e APP_APK_FILE, caminho absoluto de
// um .apk fora das pastas servidas). Sem as variáveis, o app não avisa nada e o download é 404.
const latestVersion = readLatestVersion(process.env.APP_LATEST_VERSION);
if ('error' in latestVersion) {
  console.error(`[agrotech] ${latestVersion.error}`);
  process.exit(1);
}
const APP_LATEST_VERSION = latestVersion.version;
const APP_APK_FILE = process.env.APP_APK_FILE || null;
if (APP_APK_FILE && !APP_APK_FILE.toLowerCase().endsWith('.apk')) {
  console.error('[agrotech] APP_APK_FILE precisa ser um arquivo .apk.');
  process.exit(1);
}
// DATA_FILE permite rodar contra um banco descartável (os testes de API usam isso).
const dataFile = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
// O banco morava em src/data (pasta servida como estática). Sem este aviso, quem tem o arquivo antigo
// veria o app subir com os dados de exemplo e acharia que perdeu tudo.
const legacyDataFile = path.join(ROOT, 'src', 'data', 'db.json');
if (!process.env.DATA_FILE && existsSync(legacyDataFile) && !existsSync(dataFile)) {
  console.warn(`[agrotech] Banco antigo em ${legacyDataFile}. Mova-o para ${dataFile} para manter os seus dados.`);
}

const defaultDb = {
  users: [
    {
      id: 'usr-demo',
      name: 'João Silva',
      propertyOrCompany: 'Fazenda Boa Vista',
      email: 'demo@agrotech.com.br',
      password: bcrypt.hashSync('demo123', 10),
      role: 'PRODUTOR'
    },
    {
      id: 'usr-admin',
      name: 'Administrador AgroTech',
      propertyOrCompany: 'AgroTech Oficial',
      email: 'admin@agrotech.com.br',
      password: bcrypt.hashSync('admin123', 10),
      role: 'ADMIN'
    }
  ],
  products: [
    {
      id: '1',
      name: 'Ração Bovinos Corte 30kg',
      price: 89.9,
      category: 'Rações',
      image: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=900&q=80',
      imageEmoji: '🐄',
      imageBg: '#E8F5E9',
      rating: 4.8,
      reviewsCount: 32,
      description: 'Ração de alta digestibilidade para gado de corte, enriquecida com minerais e vitaminas essenciais para ganho de peso rápido na terminação.',
      comments: [
        { author: 'Carlos Mendes', text: 'Excelente ganho de peso no rebanho em 30 dias de uso.', rating: 5 },
        { author: 'Marcos Souza', text: 'Ótimo custo-benefício para a seca.', rating: 4.5 }
      ],
      ownerEmail: 'demo@agrotech.com.br'
    },
    {
      id: '2',
      name: 'Fertilizante NPK 10-10-10 50kg',
      price: 150,
      category: 'Fertilizantes',
      image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=80',
      imageEmoji: '🧪',
      imageBg: '#E8F5E9',
      rating: 4.9,
      reviewsCount: 54,
      description: 'Formulação equilibrada ideal para plantio e manutenção de diversas culturas agrícolas, promovendo enraizamento forte.',
      comments: [
        { author: 'Sítio Boa Esperança', text: 'Usamos no milho e o desenvolvimento foliar foi surpreendente.', rating: 5 }
      ],
      ownerEmail: 'demo@agrotech.com.br'
    },
    {
      id: '3',
      name: 'Semente de Milho Híbrido 20kg',
      price: 450,
      category: 'Grãos',
      image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=80',
      imageEmoji: '🌽',
      imageBg: '#F1F8E9',
      rating: 4.7,
      reviewsCount: 18,
      description: 'Sementes tratadas com alta tolerância a pragas e seca, garantindo teto produtivo elevado para grãos e silagem.',
      comments: [
        { author: 'Fazenda Santa Maria', text: 'Germinação acima de 95%. Recomendo.', rating: 5 }
      ],
      ownerEmail: 'demo@agrotech.com.br'
    },
    {
      id: '4',
      name: 'Trator Fruteiro 75cv (Diária)',
      price: 800,
      category: 'Máquinas',
      image: 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&w=900&q=80',
      imageEmoji: '🚜',
      imageBg: '#E0F2F1',
      rating: 5,
      reviewsCount: 12,
      description: 'Aluguel por diária de trator compacto ideal para pomares e cafezais, equipado com tomada de força e tração 4x4.',
      comments: [
        { author: 'Agro Cafezal', text: 'Equipamento revisado e entregue no prazo na fazenda.', rating: 5 }
      ],
      ownerEmail: 'demo@agrotech.com.br'
    }
  ],
  orders: [
    {
      id: 'AGT-84920',
      ownerEmail: 'demo@agrotech.com.br',
      date: '15/Set/2026',
      status: 'Em trânsito',
      // Estágio 3 de TRACKING_STAGES (src/modules/tracker.js): "Saiu para Entrega" é o que está na estrada.
      statusStep: 3,
      trackingCode: 'BR-AGRO-982134-X',
      carrier: 'AgroExpress Logística Rural',
      estimatedDelivery: '18/Set/2026',
      total: 329.8,
      items: [
        { name: 'Ração Bovinos Corte 30kg', quantity: 2, price: 89.9 },
        { name: 'Fertilizante NPK 10-10-10 50kg', quantity: 1, price: 150 }
      ],
      timeline: [
        { title: 'Pedido Confirmado', time: '15/Set às 09:30', completed: true },
        { title: 'Insumos em Separação no CD', time: '15/Set às 14:15', completed: true },
        { title: 'Saiu para Entrega (Caminhão AgroExpress)', time: '16/Set às 08:00', completed: true },
        { title: 'Chegada na Fazenda', time: 'Previsão: 18/Set', completed: false }
      ]
    }
  ],
  // Lançamentos manuais do financeiro: { id, ownerEmail, type, title, amount, createdAt }.
  financeEntries: []
};

// `ver` é a versão de sessão da conta: POST /api/auth/logout a incrementa e todo token com versão
// antiga deixa de valer. Token sem `ver` (emitido antes disso) conta como versão 0.
const signToken = (user) => jwt.sign(
  { sub: user.id, email: user.email, role: user.role, ver: user.tokenVersion ?? 0 },
  JWT_SECRET,
  { expiresIn: '7d' }
);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeDbUsers = (users = []) => {
  const merged = [...users];

  for (const seed of defaultDb.users) {
    const normalizedEmail = normalizeEmail(seed.email);
    const existingIndex = merged.findIndex((user) => normalizeEmail(user.email) === normalizedEmail);

    const seedUser = {
      ...seed,
      email: normalizedEmail,
      password: seed.password.startsWith('$2') ? seed.password : bcrypt.hashSync(String(seed.password), 10)
    };

    if (existingIndex >= 0) {
      const currentUser = merged[existingIndex];
      // O que o usuário editou (nome, loja) vale; do seed vêm os campos que faltam e o perfil, que o corpo
      // de uma requisição nunca define (é como o ADMIN do seed continua ADMIN).
      merged[existingIndex] = {
        ...seedUser,
        ...currentUser,
        role: seedUser.role,
        email: normalizedEmail,
        password: currentUser.password && String(currentUser.password).startsWith('$2')
          ? currentUser.password
          : bcrypt.hashSync(String(seed.password), 10)
      };
    } else {
      merged.push(seedUser);
    }
  }

  return merged.map((user) => ({
    ...user,
    email: normalizeEmail(user.email),
    password: user.password && String(user.password).startsWith('$2')
      ? user.password
      : bcrypt.hashSync(String(user.password), 10)
  }));
};

async function ensureDbFile() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  // Só cria o arquivo quando ele não existe. Nunca regrava um existente: se estiver corrompido, a
  // leitura falha com erro (500) e o conteúdo fica intacto para conferir.
  await fs.writeFile(dataFile, JSON.stringify(defaultDb, null, 2), { encoding: 'utf8', flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error;
  });
}

async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    users: normalizeDbUsers(parsed.users || []),
    products: parsed.products || defaultDb.products,
    orders: parsed.orders || defaultDb.orders,
    financeEntries: parsed.financeEntries || [],
    // Mercado Pago (spec 10): conexões dos vendedores (tokens cifrados), states do OAuth e a comissão.
    // Precisam estar aqui: o que readDb não devolve, o próximo writeDb apaga.
    sellerAccounts: parsed.sellerAccounts || [],
    oauthStates: parsed.oauthStates || [],
    settings: parsed.settings || {}
  };
}

// Trabalho que grava fora de uma requisição POST/PUT/DELETE (webhook depois do 200, volta do OAuth por
// GET, varredura): pega a própria vez na fila de escrita, para não perder gravação de outra rota.
async function withWriteTurn(work) {
  const { turn, release } = writeQueue.acquire();
  await turn;
  try {
    return await work();
  } finally {
    release();
  }
}

async function writeDb(db) {
  await ensureDbFile();
  // Grava num arquivo temporário e troca de uma vez: quem lê vê o arquivo antigo ou o novo, nunca
  // um JSON pela metade.
  const tmp = `${dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  try {
    await renameWithRetry(fs.rename, tmp, dataFile);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

// Perfis que o próprio usuário pode escolher no cadastro; ADMIN nunca vem do corpo da requisição.
// AMBOS = comprador e vendedor na mesma conta (issue #83).
const SIGNUP_ROLES = ['PRODUTOR', 'VENDEDOR', 'AMBOS'];

// ponytail: o front monta HTML com innerHTML, então o texto do usuário é escapado aqui, na entrada,
// num lugar só. Teto: o JSON da API sai com entidades (&amp;); se outro cliente consumir a API,
// troque por escape na saída do front e grave o texto cru.
const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const cleanText = (value) => String(value).trim().replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

// Imagem do produto: link http(s) (normalizado pelo URL, que codifica aspas) ou foto enviada pelo
// app (data URL). Devolve undefined quando é inválida.
const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/;
const safeImageUrl = (value) => {
  if (!value) return null;
  if (IMAGE_DATA_URL.test(value)) return value;
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  propertyOrCompany: user.propertyOrCompany,
  email: user.email,
  role: user.role,
  storeProfileImage: user.storeProfileImage || null,
  storeCoverImage: user.storeCoverImage || null,
  storeBio: user.storeBio || '',
  storePhone: user.storePhone || '',
  storeLocation: user.storeLocation || '',
  storeHours: user.storeHours || ''
});

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticação ausente.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }

  // Fora do try do token: banco ilegível é erro do servidor (500 pelo tratador de erro), e não "token
  // inválido", que faria o app encerrar a sessão de todo mundo.
  const db = await readDb();
  // Com `sub`, o token é da conta com esse id: se ela saiu do banco, o e-mail de uma conta nova não o
  // herda. Só token sem `sub` (formato antigo) casa pelo e-mail.
  const user = decoded.sub !== undefined
    ? db.users.find((item) => item.id === decoded.sub)
    : db.users.find((item) => item.email === decoded.email);
  if (!user) {
    return res.status(401).json({ message: 'Usuário inexistente para este token.' });
  }
  if ((decoded.ver ?? 0) !== (user.tokenVersion ?? 0)) {
    return res.status(401).json({ message: 'Sessão encerrada. Entre de novo.' });
  }

  req.user = sanitizeUser(user);
  return next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
  }
  next();
};

// CORS: a SPA é da mesma origem e o app nativo não usa CORS, então o padrão é não liberar nenhuma
// origem cruzada. CORS_ORIGINS lista as permitidas (exatas, separadas por vírgula, sem barra final).
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins }));
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.json({ limit: '2mb' }));

// App abaixo da versão mínima (APP_MIN_VERSION) recebe 426 em toda rota /api, menos saúde e a própria
// configuração, que o app lê para mostrar a tela de atualização. Sem o cabeçalho X-App-Version (a SPA),
// nada é barrado.
const VERSION_FREE = new Set(['/api/health', '/api/app-config', '/api/app-download']);
app.use((req, res, next) => {
  const version = req.get('X-App-Version');
  if (version === undefined || !/^\/api(\/|$)/i.test(req.path) || VERSION_FREE.has(req.path.toLowerCase())) return next();
  if (!isBelowMinVersion(version, APP_MIN_VERSION)) return next();
  return res.status(426).json({ message: `Atualize o app: a versão mínima é ${APP_MIN_VERSION}.`, minVersion: APP_MIN_VERSION });
});

// Uma gravação por vez (ver createTurnQueue). Entra depois do parse do corpo: um cliente lento, que
// demora a mandar o corpo, não segura a fila de ninguém. O caminho casa sem diferenciar maiúsculas,
// como o roteamento do Express (/API/orders chega na mesma rota). A vez é devolvida quando a rota
// responde (res.end), e não quando a conexão cai: com o cliente desconectado a rota segue gravando.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
app.use((req, res, next) => {
  if (!WRITE_METHODS.has(req.method) || !/^\/api(\/|$)/i.test(req.path)) return next();
  const { turn, release } = writeQueue.acquire();
  let started = false;
  let gone = false;
  const end = res.end.bind(res);
  res.end = (...args) => {
    try {
      return end(...args);
    } finally {
      release();
    }
  };
  // Quem desiste ainda na fila devolve a vez e a rota nem roda; quem já está rodando termina antes.
  res.once('close', () => {
    gone = true;
    if (!started) release();
  });
  turn.then(() => {
    started = true;
    if (gone) return release();
    return next();
  });
});

// Só o front é público: a raiz tem server.js e .env, e o banco fica em src/data/. O bloqueio olha o
// caminho já decodificado, senão /src/%64ata/db.json passava por ele e o express.static decodificava
// depois e entregava o banco (usuários e hashes de senha). Também ignora a caixa e a barra invertida
// (o Windows serve src/DATA/db.json e src\data\db.json) e o ponto ou espaço no fim do nome.
app.use('/src', (req, res, next) => {
  let decoded;
  try {
    decoded = decodeURIComponent(req.path);
  } catch {
    return res.status(400).json({ message: 'Caminho inválido.' });
  }
  const segments = decoded.toLowerCase().split(/[\\/]+/).map((segment) => segment.replace(/[. ]+$/, ''));
  if (segments.includes('data')) return res.status(404).json({ message: 'Não encontrado.' });
  return next();
});
app.use('/src', express.static(path.join(ROOT, 'src')));
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/packages/domain', express.static(path.join(ROOT, 'packages', 'domain')));

app.get('/api/health', (_, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/app-config', (_, res) => {
  res.json({
    minVersion: APP_MIN_VERSION,
    latestVersion: APP_LATEST_VERSION,
    downloadUrl: APP_APK_FILE ? '/api/app-download' : null
  });
});

// APK da versão mais nova. Entrega só o arquivo configurado no servidor (nada da requisição entra no
// caminho), com o tipo de pacote Android: o navegador do celular baixa e o Android oferece instalar.
app.get('/api/app-download', (_, res) => {
  if (!APP_APK_FILE) return res.status(404).json({ message: 'Nenhuma versão do app disponível para download.' });
  const name = `agrotech-${APP_LATEST_VERSION ?? 'app'}.apk`;
  res.download(APP_APK_FILE, name, { headers: { 'Content-Type': 'application/vnd.android.package-archive' } }, (error) => {
    if (error && !res.headersSent) res.status(404).json({ message: 'Arquivo do app não encontrado no servidor.' });
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'PRODUTOR', propertyOrCompany = '' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ message: passwordError });
  if (!SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Perfil inválido: use PRODUTOR, VENDEDOR ou AMBOS.' });
  }

  const db = await readDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
  }

  const user = {
    id: newUserId(),
    name: cleanText(name),
    propertyOrCompany: cleanText(propertyOrCompany),
    email: normalizedEmail,
    password: bcrypt.hashSync(String(password), 10),
    role
  };

  db.users.push(user);
  await writeDb(db);

  const token = signToken(user);
  res.status(201).json({ user: sanitizeUser(user), token });
});

/** @type {import('./login-limiter.js').FailureStore} */
const loginFailures = new Map();

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  const db = await readDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  const wait = blockedSeconds(loginFailures, normalizedEmail, Date.now());
  if (wait > 0) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ message: 'Muitas tentativas de login. Tente de novo em alguns minutos.' });
  }
  const user = db.users.find((item) => item.email === normalizedEmail);
  if (!user || !bcrypt.compareSync(String(password), user.password)) {
    recordFailure(loginFailures, normalizedEmail, Date.now());
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
  }
  clearFailures(loginFailures, normalizedEmail);

  const token = signToken(user);
  res.json({ user: sanitizeUser(user), token });
});

// Redefinição de senha por código que o ADMIN gera e repassa por fora (não há e-mail: decisão pendente
// do dono). Código de 8 caracteres de um alfabeto de 32 (sem 0, O, 1, I), guardado só como hash,
// válido por 30 minutos e de uso único. E-mail errado e código errado dão a mesma resposta, com o
// mesmo custo de bcrypt (hash falso), e as tentativas contam no mesmo limite do login.
const RESET_CODE_TTL_MS = 30 * 60 * 1000;
const RESET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RESET_DECOY_HASH = bcrypt.hashSync('codigo-que-nunca-confere', 10);
const RESET_FAILED = 'Código inválido ou vencido. Peça um novo ao suporte.';

function newResetCode() {
  // 256 é múltiplo de 32: o resto da divisão não favorece nenhuma letra.
  return [...crypto.randomBytes(8)].map((byte) => RESET_ALPHABET[byte % RESET_ALPHABET.length]).join('');
}

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const wait = blockedSeconds(loginFailures, normalizedEmail, Date.now());
  if (wait > 0) {
    res.set('Retry-After', String(wait));
    return res.status(429).json({ message: 'Muitas tentativas. Tente de novo em alguns minutos.' });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ message: passwordError });

  const db = await readDb();
  const user = db.users.find((item) => item.email === normalizedEmail);
  const live = Boolean(user?.resetCodeHash) && Date.now() < Date.parse(user.resetCodeExpiresAt || '');
  const matches = bcrypt.compareSync(String(code || '').trim().toUpperCase(), live ? user.resetCodeHash : RESET_DECOY_HASH);
  if (!user || !live || !matches) {
    recordFailure(loginFailures, normalizedEmail, Date.now());
    return res.status(400).json({ message: RESET_FAILED });
  }
  clearFailures(loginFailures, normalizedEmail);
  user.password = bcrypt.hashSync(String(password), 10);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  delete user.resetCodeHash;
  delete user.resetCodeExpiresAt;
  await writeDb(db);
  res.status(204).end();
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// Exclusão de conta: remove usuário, anúncios e lançamentos; os pedidos ficam (o vendedor da outra
// ponta precisa deles), sem o e-mail. Avaliações guardam só o nome do autor, sem referência à conta:
// não dá para removê-las com segurança. Senha errada é 403, e não 401: o app encerra a sessão em todo 401.
// Tira do produto as avaliações de uma conta (vínculo: authorEmail) e recalcula nota e total como a rota
// de excluir avaliação. Sem avaliação da conta, o produto não muda. Avaliação sem authorEmail (seed ou
// anterior ao vínculo) não é reivindicada por ninguém.
function dropReviewsOf(product, email) {
  const comments = product.comments || [];
  const kept = comments.filter((comment) => comment.authorEmail !== email);
  if (kept.length === comments.length) return;
  product.comments = kept;
  product.reviewsCount = kept.length;
  product.rating = kept.length
    ? parseFloat((kept.reduce((acc, comment) => acc + Number(comment.rating || 0), 0) / kept.length).toFixed(1))
    : 0;
}

app.delete('/api/auth/me', authenticate, async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ message: 'Informe a senha para excluir a conta.' });
  }
  if (req.user.role === 'ADMIN') {
    return res.status(403).json({ message: 'Conta administradora não pode ser excluída por aqui.' });
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === req.user.id);
  if (!user || !bcrypt.compareSync(String(password), user.password)) {
    return res.status(403).json({ message: 'Senha incorreta.' });
  }

  const { email } = user;
  const removedEmail = (orderId) => `conta-excluida-${orderId}@removido.invalid`;
  db.users = db.users.filter((item) => item.id !== user.id);
  db.products = db.products.filter((item) => item.ownerEmail !== email);
  db.financeEntries = db.financeEntries.filter((item) => item.ownerEmail !== email);
  // A conexão Mercado Pago (tokens) sai junto com a conta (spec 10, RF-01).
  db.sellerAccounts = db.sellerAccounts.filter((item) => item.userId !== user.id);
  db.oauthStates = db.oauthStates.filter((item) => item.userId !== user.id);
  for (const product of db.products) dropReviewsOf(product, email);
  for (const order of db.orders) {
    if (order.ownerEmail === email) order.ownerEmail = removedEmail(order.id);
    for (const item of order.items || []) {
      if (item.ownerEmail !== email) continue;
      item.ownerEmail = removedEmail(order.id);
      item.sellerName = 'Vendedor removido';
    }
  }
  await writeDb(db);
  res.status(204).end();
});

// Encerra todas as sessões da conta de uma vez: incrementa a versão, e os tokens emitidos antes não
// passam mais em `authenticate`. Com mais de um aparelho logado, todos saem.
app.post('/api/auth/logout', authenticate, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.user.id);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await writeDb(db);
  res.status(204).end();
});

app.put('/api/auth/store', authenticate, async (req, res) => {
  const {
    name, propertyOrCompany, storeProfileImage, storeCoverImage,
    storeBio, storePhone, storeLocation, storeHours
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'O nome é obrigatório.' });
  }

  // A imagem da loja passa pelo mesmo filtro da do produto (link http(s) ou foto enviada).
  const profileImage = safeImageUrl(String(storeProfileImage || '').trim());
  const coverImage = safeImageUrl(String(storeCoverImage || '').trim());
  if ((storeProfileImage !== undefined && profileImage === undefined) || (storeCoverImage !== undefined && coverImage === undefined)) {
    return res.status(400).json({ message: 'Imagem inválida: use um link http(s) ou envie uma foto.' });
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }

  // Todo texto que volta para a tela como HTML é escapado aqui, como no cadastro (cleanText).
  user.name = cleanText(String(name).slice(0, 120));
  if (propertyOrCompany !== undefined) user.propertyOrCompany = cleanText(String(propertyOrCompany || '').slice(0, 120));
  if (storeProfileImage !== undefined) user.storeProfileImage = profileImage;
  if (storeCoverImage !== undefined) user.storeCoverImage = coverImage;
  if (storeBio !== undefined) user.storeBio = cleanText(String(storeBio || '').slice(0, 500));
  if (storePhone !== undefined) user.storePhone = cleanText(String(storePhone || '').slice(0, 120));
  if (storeLocation !== undefined) user.storeLocation = cleanText(String(storeLocation || '').slice(0, 120));
  if (storeHours !== undefined) user.storeHours = cleanText(String(storeHours || '').slice(0, 120));

  await writeDb(db);
  res.json({ user: sanitizeUser(user) });
});

// Paginação opcional: sem limit a lista inteira (a SPA lê o catálogo todo); o total vai em X-Total-Count.
const MAX_PAGE_SIZE = 100;
const parseInteger = (raw) => (/^\d+$/.test(raw) ? Number(raw) : NaN);

// Lista pública: o e-mail de quem avaliou fica no banco (é o vínculo para excluir a conta e a própria
// avaliação), mas não sai na resposta. A SPA mostra só autor, nota e texto.
const publicComment = (comment) => ({ id: comment.id, author: comment.author, text: comment.text, rating: comment.rating });
// A chave e o hash de idempotência do anúncio são do dono: não saem no catálogo público.
const publicProduct = (stored) => {
  const product = { ...stored };
  delete product.idempotencyKey;
  delete product.requestHash;
  return product.comments ? { ...product, comments: product.comments.map(publicComment) } : product;
};

app.get('/api/products', async (req, res) => {
  const { page, limit } = req.query;
  let pageNumber = 1;
  let pageSize = null;
  if (limit !== undefined) {
    pageSize = parseInteger(limit);
    if (!(pageSize >= 1 && pageSize <= MAX_PAGE_SIZE)) {
      return res.status(400).json({ message: `Parâmetro limit inválido: use um inteiro de 1 a ${MAX_PAGE_SIZE}.` });
    }
  } else if (page !== undefined) {
    return res.status(400).json({ message: 'Parâmetro page exige limit: informe o tamanho da página.' });
  }
  if (page !== undefined) {
    pageNumber = parseInteger(page);
    if (!(pageNumber >= 1)) return res.status(400).json({ message: 'Parâmetro page inválido: use um inteiro a partir de 1.' });
  }
  const { products } = await readDb();
  res.set('X-Total-Count', String(products.length));
  const visible = (pageSize ? products.slice((pageNumber - 1) * pageSize, pageNumber * pageSize) : products).map(publicProduct);
  res.json(visible);
});

// Tetos de entrada: sem eles, 1e308 vira total "Infinity", que o JSON grava como null.
const MAX_PRICE = 10_000_000;
const MAX_STOCK = 1_000_000;
const MAX_ORDER_QUANTITY = 10_000;
// Idempotência do pedido: o app repete o POST quando a rede cai no meio, e sem chave isso vira pedido
// duplicado. A chave é do cliente (8 a 64 caracteres seguros para cabeçalho). Guardamos um hash do
// pedido pedido, para a mesma chave com outros itens não ser tomada por reenvio.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

// Hash do que o cliente pediu (produto e quantidade, na ordem, e o cupom): diferencia um reenvio de um
// pedido novo que reaproveitou a mesma chave.
function orderFingerprint(lines, coupon) {
  return crypto.createHash('sha256').update(JSON.stringify({
    items: lines.map(({ product, quantity }) => [product.id, quantity]),
    coupon: typeof coupon === 'string' ? coupon.toUpperCase() : null
  })).digest('hex');
}

// Campos que o pedido guarda para a chave; vazio quando o cliente não mandou chave.
function idempotencyFields(key, lines, coupon) {
  return key === undefined ? {} : { idempotencyKey: key, requestHash: orderFingerprint(lines, coupon) };
}

// Resposta de reenvio: 200 com o pedido já criado; 409 se a chave veio com outros itens; 400 se for
// malformada. Devolve null quando a chave é nova ou não foi enviada (aí o pedido é criado).
function replayResponse(records, email, key, fingerprint, what) {
  if (key === undefined) return null;
  if (!IDEMPOTENCY_KEY_RE.test(key)) {
    return { status: 400, body: { message: 'Idempotency-Key inválida: use de 8 a 64 letras, números, _ ou -.' } };
  }
  const previous = records.find((record) => record.ownerEmail === email && record.idempotencyKey === key);
  if (!previous) return null;
  if (previous.requestHash !== fingerprint) {
    return { status: 409, body: { message: `Essa Idempotency-Key já foi usada com outro ${what}.` } };
  }
  return { status: 200, body: previous };
}

function replayOrderResponse(db, email, key, lines, coupon) {
  return replayResponse(db.orders, email, key, key === undefined ? '' : orderFingerprint(lines, coupon), 'pedido');
}

// Hash do anúncio pedido (os campos do corpo, já com os padrões): diferencia o reenvio da fila offline
// do app de um anúncio novo que reaproveitou a chave.
function productFingerprint(fields) {
  return crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

app.post('/api/products', authenticate, async (req, res) => {
  const {
    name, price, category, description, imageUrl,
    unit = 'unidade',
    location = 'Região Agrícola - BR',
    stock = 100,
    shippingType = 'CIF - Entrega na Fazenda',
    certification = 'Emite Nota Fiscal e Certificado MAPA'
  } = req.body;
  if (!name || !price || !category || !description) {
    return res.status(400).json({ message: 'Dados do produto incompletos.' });
  }
  const priceValue = Number(price);
  const stockValue = Number(stock);
  if (!Number.isFinite(priceValue) || priceValue <= 0 || priceValue > MAX_PRICE || !Number.isFinite(stockValue) || stockValue < 0 || stockValue > MAX_STOCK) {
    return res.status(400).json({ message: 'O preço deve ser maior que zero (até R$ 10.000.000) e o estoque não pode ser negativo (até 1.000.000).' });
  }
  const image = safeImageUrl(imageUrl);
  if (image === undefined) {
    return res.status(400).json({ message: 'Imagem inválida: use um link http(s) ou envie uma foto.' });
  }
  const style = getProductCategoryStyle(String(category).trim());
  const idempotencyKey = req.get('Idempotency-Key');
  const fingerprint = productFingerprint([name, priceValue, category, description, imageUrl ?? null, unit, location, stockValue, shippingType, certification]);

  const db = await readDb();
  const replay = replayResponse(db.products, req.user.email, idempotencyKey, fingerprint, 'anúncio');
  if (replay) return res.status(replay.status).json(replay.status === 200 ? publicProduct(replay.body) : replay.body);
  const product = {
    id: newProductId(),
    ...(idempotencyKey === undefined ? {} : { idempotencyKey, requestHash: fingerprint }),
    name: cleanText(name),
    price: priceValue,
    category: cleanText(category),
    unit: cleanText(unit),
    location: cleanText(location),
    stock: stockValue,
    shippingType: cleanText(shippingType),
    certification: cleanText(certification),
    image,
    imageEmoji: style.emoji,
    imageBg: style.bg,
    rating: 0,
    reviewsCount: 0,
    description: cleanText(description),
    ownerEmail: req.user.email,
    sellerName: req.user.propertyOrCompany || req.user.name || 'Produtor Rural',
    comments: []
  };

  db.products.unshift(product);
  await writeDb(db);
  res.status(201).json(publicProduct(product));
});

app.post('/api/products/:id/reviews', authenticate, async (req, res) => {
  const { text, rating = 5 } = req.body;
  if (!text || !String(text).trim()) {
    return res.status(400).json({ message: 'O texto da avaliação é obrigatório.' });
  }

  const db = await readDb();
  const product = db.products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Produto não encontrado.' });
  }

  const review = {
    id: newReviewId(),
    author: req.user.name || req.user.propertyOrCompany || 'Produtor Rural',
    authorEmail: req.user.email,
    text: cleanText(String(text).trim().slice(0, 600)),
    rating: Number.isFinite(Number(rating)) ? Math.min(5, Math.max(0, Number(rating))) : 5
  };

  product.comments = product.comments || [];
  product.comments.unshift(review);
  product.reviewsCount = product.comments.length;
  product.rating = parseFloat((product.comments.reduce((acc, c) => acc + Number(c.rating || 0), 0) / product.reviewsCount).toFixed(1));

  await writeDb(db);
  res.status(201).json({ review, rating: product.rating, reviewsCount: product.reviewsCount });
});

app.delete('/api/products/:id/reviews/:reviewId', authenticate, async (req, res) => {
  const db = await readDb();
  const product = db.products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Produto não encontrado.' });
  }

  product.comments = product.comments || [];
  const review = product.comments.find((c) => c.id === req.params.reviewId);
  if (!review) {
    return res.status(404).json({ message: 'Avaliação não encontrada.' });
  }

  if (req.user.role !== 'ADMIN' && review.authorEmail !== req.user.email) {
    return res.status(403).json({ message: 'Você só pode excluir as suas próprias avaliações.' });
  }

  product.comments = product.comments.filter((c) => c.id !== req.params.reviewId);
  product.reviewsCount = product.comments.length;
  product.rating = product.reviewsCount
    ? parseFloat((product.comments.reduce((acc, c) => acc + Number(c.rating || 0), 0) / product.reviewsCount).toFixed(1))
    : 0;

  await writeDb(db);
  res.status(204).end();
});

app.delete('/api/products/:id', authenticate, async (req, res) => {
  const db = await readDb();
  const product = db.products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Produto não encontrado.' });
  }

  if (req.user.role !== 'ADMIN' && product.ownerEmail !== req.user.email) {
    return res.status(403).json({ message: 'Você não pode remover este produto.' });
  }

  db.products = db.products.filter((item) => item.id !== req.params.id);
  await writeDb(db);
  res.status(204).end();
});

app.get('/api/orders', authenticate, async (req, res) => {
  const db = await readDb();
  // Pedido sem dono (gravado antes desta regra) só aparece para o admin.
  const orders = req.user.role === 'ADMIN' ? db.orders : db.orders.filter((order) => order.ownerEmail === req.user.email);
  res.json(orders);
});

// Mensagem do primeiro produto sem estoque para a quantidade pedida, ou null. Só produto com stock
// numérico conta (os de demonstração não têm).
function stockShortage(wanted) {
  for (const [product, quantity] of wanted) {
    if (typeof product.stock === 'number' && quantity > product.stock) {
      return `Estoque insuficiente para ${product.name}: há ${product.stock} disponível(is).`;
    }
  }
  return null;
}

app.post('/api/orders', authenticate, async (req, res) => {
  const { items, coupon = null } = req.body;
  const idempotencyKey = req.get('Idempotency-Key');

  const db = await readDb();
  // Preço e total saem do catálogo e da mesma regra do carrinho (calculateCartSummary), nunca do cliente.
  const lines = Array.isArray(items)
    ? items.map((item) => ({ product: db.products.find((p) => p.id === String(item?.id)), quantity: Number(item?.quantity) }))
    : [];
  if (!lines.length || lines.some(({ product, quantity }) => !product || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY)) {
    return res.status(400).json({ message: `Itens do pedido inválidos: informe produtos do catálogo e quantidades inteiras de 1 a ${MAX_ORDER_QUANTITY}.` });
  }
  // Só o que a tela de pedidos e o financeiro leem. O produto inteiro levava junto a foto (data URL de
  // até 2 MB) e os comentários, e o db.json, relido a cada requisição, crescia a cada compra.
  const replay = replayOrderResponse(db, req.user.email, idempotencyKey, lines, coupon);
  if (replay) return res.status(replay.status).json(replay.body);

  // Estoque: só produto com stock numérico (os de demonstração não têm). Soma as linhas do mesmo
  // produto. O reenvio com a mesma chave voltou acima, então nunca baixa duas vezes.
  const wanted = new Map();
  for (const { product, quantity } of lines) wanted.set(product, (wanted.get(product) || 0) + quantity);
  const shortage = stockShortage(wanted);
  if (shortage) return res.status(409).json({ message: shortage });

  const orderItems = lines.map(({ product, quantity }) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
    category: product.category,
    ownerEmail: product.ownerEmail,
    sellerName: product.sellerName,
    imageEmoji: product.imageEmoji,
    imageBg: product.imageBg,
    quantity
  }));
  const { total } = calculateCartSummary(orderItems, typeof coupon === 'string' ? coupon.toUpperCase() : null);
  if (!Number.isFinite(total)) {
    return res.status(400).json({ message: 'Não foi possível calcular o total do pedido.' });
  }

  const order = {
    id: newOrderId(),
    ownerEmail: req.user.email,
    ...idempotencyFields(idempotencyKey, lines, coupon),
    // Data real do pedido: "Meus Pedidos" a mostra em dd/mm/aaaa e o financeiro recorta por mês.
    createdAt: new Date().toISOString(),
    status: 'Pedido Confirmado',
    statusStep: 1,
    trackingCode: newTrackingCode(),
    carrier: 'AgroExpress Logística Rural',
    estimatedDelivery: 'Em 3 a 5 dias úteis',
    total,
    items: orderItems,
    timeline: [
      { title: 'Pedido Confirmado', time: 'Hoje', completed: true },
      { title: 'Insumos em Separação no CD', time: 'Aguardando', completed: false },
      { title: 'Saiu para Entrega', time: 'Aguardando', completed: false },
      { title: 'Chegada na Fazenda', time: 'Previsão em breve', completed: false }
    ]
  };

  // Com Mercado Pago, o pedido nasce aguardando pagamento e a baixa abaixo vira a reserva do estoque.
  const failure = await startOrderPayment(db, order, lines, req.body.returnTo);
  if (failure) return res.status(failure.status).json({ message: failure.message });
  for (const [product, quantity] of wanted) {
    if (typeof product.stock === 'number') product.stock -= quantity;
  }
  db.orders.unshift(order);
  await writeDb(db);
  res.status(201).json(order);
});

// Extrato financeiro da conta da sessão, inclusive para o ADMIN (o total da plataforma fica em
// /api/admin/summary): compras, vendas dos produtos dela e lançamentos manuais.
app.get('/api/finance/entries', authenticate, async (req, res) => {
  const db = await readDb();
  res.json(buildFinanceEntries(db, req.user.email));
});

const FINANCE_ENTRY_TYPES = ['INCOME', 'EXPENSE'];

app.post('/api/finance/entries', authenticate, async (req, res) => {
  const { title, amount, type } = req.body;
  const amountValue = Number(amount);
  if (!title || !String(title).trim() || !Number.isFinite(amountValue) || amountValue <= 0 || !FINANCE_ENTRY_TYPES.includes(type)) {
    return res.status(400).json({ message: 'Lançamento inválido: informe a descrição, um valor maior que zero e o tipo INCOME ou EXPENSE.' });
  }

  const db = await readDb();
  const entry = {
    id: crypto.randomUUID(),
    ownerEmail: req.user.email,
    type,
    title: cleanText(String(title).trim().slice(0, 120)),
    amount: amountValue,
    createdAt: new Date().toISOString()
  };
  db.financeEntries.unshift(entry);
  await writeDb(db);
  // Responde no mesmo formato do extrato (GET acima), pela mesma função.
  res.status(201).json(buildFinanceEntries({ financeEntries: [entry] }, req.user.email)[0]);
});

app.get('/api/admin/summary', authenticate, requireAdmin, async (_, res) => {
  const db = await readDb();
  // Receita só do que foi pago: pendente, cancelado e estornado não entram (spec 10, RF-09).
  const revenue = db.orders
    .filter((order) => countsAsSale(order) && order.paymentStatus !== PAYMENT_STATUS.ESTORNADO)
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  res.json({
    totalUsers: db.users.length,
    totalProducts: db.products.length,
    totalOrders: db.orders.length,
    revenue
  });
});

app.post('/api/admin/users/:id/reset-code', authenticate, requireAdmin, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
  const code = newResetCode();
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
  user.resetCodeHash = bcrypt.hashSync(code, 10);
  user.resetCodeExpiresAt = expiresAt;
  await writeDb(db);
  res.status(201).json({ code, expiresAt });
});

app.get('/api/admin/users', authenticate, requireAdmin, async (_, res) => {
  const db = await readDb();
  const users = db.users.map(({ id, name, email, role, propertyOrCompany }) => ({ id, name, email, role, propertyOrCompany }));
  res.json(users);
});

// --- Pagamento pelo Mercado Pago (spec 10, parte 1). Contratos em .ai/specs/05-openapi-spec.md. ---

// ponytail: as chamadas ao Mercado Pago dentro do pedido e do sync seguram a fila de escrita global
// (até 10 s de timeout). No volume atual (um arquivo JSON) é aceitável; com o banco da spec 06, a
// chamada sai da transação.
async function startOrderPayment(db, order, lines, returnTo) {
  if (!MP) return null;
  try {
    await preparePayment(MP, db, order, lines, returnTo, Date.now());
    return null;
  } catch (error) {
    if (!(error instanceof PaymentFlowError)) throw error;
    // Só a renovação do token do vendedor é gravada; o pedido e a reserva não entram.
    if (error.persist) await writeDb(db);
    return error;
  }
}

const requireMercadoPago = (_, res, next) => (MP
  ? next()
  : res.status(404).json({ message: 'Pagamento pelo Mercado Pago não está ligado neste servidor.' }));

const flowErrorStatus = (error) => {
  if (error instanceof PaymentFlowError) return error.status;
  if (error instanceof MercadoPagoError) return 502;
  throw error;
};

app.post('/api/mp/connect', requireMercadoPago, authenticate, async (req, res) => {
  const db = await readDb();
  let url;
  try {
    url = startSellerConnection(MP, db, req.user, Date.now());
  } catch (error) {
    return res.status(flowErrorStatus(error)).json({ message: error.message });
  }
  await writeDb(db);
  res.json({ url });
});

// Volta do OAuth no navegador do vendedor: sem token (o usuário sai do state) e por GET, então pega a
// vez da fila sozinha. A página só mostra mensagens fixas: nada da query volta para o HTML.
const connectionPage = (message) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">`
  + `<meta name="viewport" content="width=device-width,initial-scale=1"><title>AgroTech</title></head>`
  + `<body style="font-family:sans-serif;padding:24px"><p>${message}</p></body></html>`;

app.get('/api/mp/callback', requireMercadoPago, async (req, res) => {
  const outcome = await withWriteTurn(async () => {
    const db = await readDb();
    const result = await completeSellerConnection(MP, db, req.query, Date.now());
    await writeDb(db);
    return result;
  });
  res.status(outcome.status).type('html').send(connectionPage(outcome.message));
});

app.get('/api/mp/status', requireMercadoPago, authenticate, async (req, res) => {
  const { sellerAccounts } = await readDb();
  const account = sellerAccounts.find((item) => item.userId === req.user.id && item.status === 'CONECTADA');
  res.json({ connected: Boolean(account), expiresAt: account?.expiresAt ?? null });
});

app.delete('/api/mp/connect', requireMercadoPago, authenticate, async (req, res) => {
  const db = await readDb();
  db.sellerAccounts = db.sellerAccounts.filter((item) => item.userId !== req.user.id);
  await writeDb(db);
  res.status(204).end();
});

app.get('/api/admin/settings', authenticate, requireAdmin, async (_, res) => {
  const { settings } = await readDb();
  res.json({ marketplaceFeePercent: Number(settings.marketplaceFeePercent ?? 0) });
});

// Comissão em %, de 0 a 30, com até 2 casas (vira pontos-base na conta).
const isFeePercent = (value) => typeof value === 'number' && value >= 0 && value <= MAX_FEE_PERCENT
  && Math.abs(Math.round(value * 100) - value * 100) < 1e-9;

app.put('/api/admin/settings', authenticate, requireAdmin, async (req, res) => {
  const percent = req.body?.marketplaceFeePercent;
  if (!isFeePercent(percent)) {
    return res.status(400).json({ message: `A comissão vai de 0 a ${MAX_FEE_PERCENT}%, com até 2 casas decimais.` });
  }
  const db = await readDb();
  db.settings.marketplaceFeePercent = percent;
  await writeDb(db);
  res.json({ marketplaceFeePercent: percent });
});

// Volta do Checkout Pro: o app pede para conferir. Quem decide é a consulta ao Mercado Pago, nunca o app.
app.post('/api/orders/:id/sync', authenticate, async (req, res) => {
  const db = await readDb();
  const order = db.orders.find((item) => item.id === req.params.id && (req.user.role === 'ADMIN' || item.ownerEmail === req.user.email));
  if (!order) return res.status(404).json({ message: 'Pedido não encontrado.' });
  if (MP) {
    try {
      if (await syncOrder(MP, db, order, Date.now())) await writeDb(db);
    } catch (error) {
      if (error.persist) await writeDb(db);
      return res.status(flowErrorStatus(error)).json({ message: 'Não foi possível consultar o pagamento agora.' });
    }
  }
  res.json(order);
});

// Webhook: assinatura antes de tudo; depois processa e só então responde 200. Falhou (Mercado Pago fora,
// gravação recusada)? 500, e o Mercado Pago reenvia; reenvio é inofensivo (aplicação idempotente).
// Diverge do "200 antes" do guia do plugin de propósito: com o 200 antes, uma falha perdia o estorno, que
// a varredura não recupera (ela só olha pedido aguardando). A consulta tem teto de 10 s, dentro dos 22 s.
app.post('/api/payments/webhook', requireMercadoPago, async (req, res) => {
  const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? '');
  const check = verifyWebhookSignature({ xSignature: req.get('x-signature'), xRequestId: req.get('x-request-id'), dataId, secret: MP.webhookSecret });
  if (check !== 'ok') return res.status(check === 'missing' ? 400 : 401).json({ message: 'Notificação sem assinatura válida.' });
  const notification = { type: String(req.query.type ?? req.body?.type ?? ''), dataId, userId: req.body?.user_id };
  try {
    const db = await readDb();
    if (await processNotification(MP, db, notification, Date.now())) await writeDb(db);
  } catch (error) {
    console.warn(`[agrotech] notificação do pagamento ${dataId}: ${error.message}`);
    return res.status(500).json({ message: 'Não foi possível processar agora; reenvie.' });
  }
  res.status(200).json({ ok: true });
});

// Varredura: reserva vencida cancela e devolve o estoque; pendente antigo é reconsultado. Uma passada por
// vez (a anterior ainda rodando faz esta pular).
let sweeping = false;
if (MP) {
  setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    withWriteTurn(async () => {
      const db = await readDb();
      if (await sweepPayments(MP, db, Date.now())) await writeDb(db);
    }).catch((error) => console.warn(`[agrotech] varredura de pagamentos: ${error.message}`))
      .finally(() => { sweeping = false; });
  }, MP.sweepMs).unref();
}

// Rota /api que não existe não cai na SPA: responde 404 em JSON, como o resto da API (issue #26).
app.all('/api/*', (_, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// Erro de rota (ex.: db.json ilegível) vira 500 com { message }, sem derrubar o processo. Erro do
// próprio cliente (JSON malformado = 400, corpo grande demais = 413) leva o status dele, não 500.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status < 500) {
    return res.status(status).json({ message: status === 413 ? 'Corpo da requisição grande demais.' : 'Requisição inválida.' });
  }
  // Só a pilha: o erro do body-parser carrega `body` com o que o cliente mandou (pode ser a senha).
  console.error('[agrotech]', error?.stack || error?.message || error);
  return res.status(500).json({ message: 'Erro ao acessar os dados do servidor.' });
});

// Com PORT=0 o sistema escolhe uma porta livre no próprio listen (sem corrida com outros processos nos
// testes). O log mostra a porta real, que o helper dos testes lê.
const httpServer = app.listen(PORT, () => {
  console.log(`AgroTech backend running on http://localhost:${httpServer.address().port}`);
});
