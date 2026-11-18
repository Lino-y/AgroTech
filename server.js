import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { getProductCategoryStyle } from './src/services/catalog.js';
import { calculateCartSummary } from './src/services/commerce.js';
import { buildFinanceEntries } from './src/services/finance.js';
import { newOrderId, newProductId, newTrackingCode } from './src/services/ids.js';
import { canTransition, validatePaymentRequest } from './src/services/payment.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

// Uma gravação por vez: a rota lê, altera e grava o db.json dentro da mesma vez, sem outra gravação
// no meio (senão uma perde o que a outra gravou). A vez passa quando a resposta sai ou a conexão cai.
// GET não entra na fila. Teto: um cliente que nunca termina a requisição trava a fila; um timeout de
// requisição é o próximo passo se isso acontecer.
let dbQueue = Promise.resolve();
// A rota é case-insensitiva no Express: /API/finance/entries é a mesma rota. Alinhamos a fila
// com o que o Express considera: tudo que começa com /api em qualquer caixa entra na fila.
app.use((req, res, next) => {
  if (req.method === 'GET' || !req.path.toLowerCase().startsWith('/api')) return next();
  const previous = dbQueue;
  let done;
  dbQueue = new Promise((resolve) => { done = resolve; });
  res.once('finish', done);
  res.once('close', done);
  previous.then(next);
});

const PORT = Number(process.env.PORT || 3001);
// Sem JWT_SECRET, segredo aleatório por processo — nunca um valor fixo no código, que está
// no GitHub e deixaria qualquer um forjar token de admin. Custo: o login cai a cada reinício.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[agrotech] JWT_SECRET ausente: usando segredo aleatório (o login cai a cada reinício). Defina-o no .env.');
}
// DATA_FILE permite rodar contra um banco descartável (os testes de API usam isso).
const dataFile = process.env.DATA_FILE || path.join(__dirname, 'src', 'data', 'db.json');

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
      // O status e o estágio do rastreio dizem a mesma coisa, inclusive no seed (issue #41).
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

const signToken = (user) => jwt.sign(
  { sub: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeDbUsers = (users = []) => {
  // ponytail: o seed do demo e do admin é reaplicado a cada leitura para não exigir migração,
  // mas só completa campos que faltam — nunca sobrescreve o perfil que o usuário editou.
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
      merged[existingIndex] = {
        ...seedUser,
        ...currentUser,
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
    payments: parsed.payments || []
  };
}

async function writeDb(db) {
  await ensureDbFile();
  // Grava num arquivo temporário e troca de uma vez: quem lê vê o arquivo antigo ou o novo, nunca
  // um JSON pela metade.
  const tmp = `${dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, dataFile);
}

// Perfis que o próprio usuário pode escolher no cadastro; ADMIN nunca vem do corpo da requisição.
const SIGNUP_ROLES = ['PRODUTOR', 'VENDEDOR'];

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
  // Banco ilegível aqui é erro de servidor (500), não "token inválido": quem mandou o token
  // errou nada; o servidor é que não consegue ler os usuários.
  try {
    const db = await readDb();
    const user = db.users.find((item) => item.id === decoded.sub || item.email === decoded.email);
    if (!user) {
      return res.status(401).json({ message: 'Usuário inexistente para este token.' });
    }

    req.user = sanitizeUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
  }
  next();
};

app.use(cors());
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
// Só o front é público: a raiz tem server.js e .env, e o banco fica em src/data/.
// O banco mora em src/data, que fica dentro da pasta servida como estática. O bloqueio compara
// o caminho DEPOIS de decodificar (senão /src/%64ata/db.json passava) e em minúsculas.
app.use('/src', (req, res, next) => {
  if (decodeURIComponent(req.path).toLowerCase().replace(/\\/g, '/').includes('/data/')) {
    return res.status(404).json({ message: 'Não encontrado.' });
  }
  next();
});
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/api/health', (_, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'PRODUTOR', propertyOrCompany = '' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (!SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Perfil inválido: use PRODUTOR ou VENDEDOR.' });
  }

  const db = await readDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
  }

  const user = {
    // Id em UUID: o relógio (Date.now) repetia para dois cadastros no mesmo milissegundo.
    id: `usr-${crypto.randomUUID()}`,
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

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  const db = await readDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.users.find((item) => item.email === normalizedEmail);
  if (!user || !bcrypt.compareSync(String(password), user.password)) {
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
  }

  const token = signToken(user);
  res.json({ user: sanitizeUser(user), token });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/auth/store', authenticate, async (req, res) => {
  const {
    name, propertyOrCompany, storeProfileImage, storeCoverImage,
    storeBio, storePhone, storeLocation, storeHours
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'O nome é obrigatório.' });
  }

  const db = await readDb();
  const user = db.users.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }

  // Foto/capa podem vir como link http(s) ou arquivo enviado (data URL de imagem).
  // Aspa é removida: em atributo HTML uma aspa fecharia a tag e permitiria XSS.
  const imagePattern = /^(https?:\/\/.+|data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+)$/i; // eslint-disable-line no-useless-escape -- \/ dentro de regex é legível e não muda o casamento
  const cleanImage = (value) => String(value || '').replace(/"/g, '').trim() || null;
  if (storeProfileImage && !imagePattern.test(cleanImage(storeProfileImage))) {
    return res.status(400).json({ message: 'Imagem de perfil inválida.' });
  }
  if (storeCoverImage && !imagePattern.test(cleanImage(storeCoverImage))) {
    return res.status(400).json({ message: 'Imagem de capa inválida.' });
  }
  const profileImage = storeProfileImage !== undefined ? cleanImage(storeProfileImage) : undefined;
  const coverImage = storeCoverImage !== undefined ? cleanImage(storeCoverImage) : undefined;

  // O nome do usuário vira autor de avaliação e título de loja no HTML do front: escapa aqui, na entrada.
  user.name = cleanText(name);
  if (propertyOrCompany !== undefined) user.propertyOrCompany = cleanText(propertyOrCompany);
  if (profileImage !== undefined) user.storeProfileImage = profileImage;
  if (coverImage !== undefined) user.storeCoverImage = coverImage;
  if (storeBio !== undefined) user.storeBio = cleanText(String(storeBio || '').slice(0, 500));
  if (storePhone !== undefined) user.storePhone = cleanText(storePhone);
  if (storeLocation !== undefined) user.storeLocation = cleanText(storeLocation);
  if (storeHours !== undefined) user.storeHours = cleanText(storeHours);

  await writeDb(db);
  res.json({ user: sanitizeUser(user) });
});

app.get('/api/store/:email', async (req, res) => {
  const db = await readDb();
  const email = String(req.params.email || '').trim().toLowerCase();
  const seller = (db.users || []).find(u => String(u.email || '').toLowerCase() === email);
  if (!seller) return res.status(404).json({ message: 'Loja não encontrada.' });
  res.json({ user: sanitizeUser(seller) });
});

app.get('/api/products', async (_, res) => {
  const db = await readDb();
  res.json(db.products);
});

app.post('/api/products', authenticate, async (req, res) => {
  const {
    name, price, category, description, imageUrl,
    unit = 'unidade',
    location = 'Região Agrícola - BR',
    stock = 100,
    shippingType = 'CIF - Entrega na Fazenda',
    certification = 'Emite Nota Fiscal e Certificado MAPA',
    announced
  } = req.body;
  if (!name || !price || !category || !description) {
    return res.status(400).json({ message: 'Dados do produto incompletos.' });
  }
  const priceValue = Number(price);
  const stockValue = Number(stock);
  if (!Number.isFinite(priceValue) || priceValue <= 0 || !Number.isFinite(stockValue) || stockValue < 0) {
    return res.status(400).json({ message: 'O preço deve ser maior que zero e o estoque não pode ser negativo.' });
  }
  const image = safeImageUrl(imageUrl);
  if (image === undefined) {
    return res.status(400).json({ message: 'Imagem inválida: use um link http(s) ou envie uma foto.' });
  }
  if (!image) {
    return res.status(400).json({ message: 'A foto do produto é obrigatória: envie uma imagem ou use um link http(s).' });
  }
  const style = getProductCategoryStyle(String(category).trim());

  const db = await readDb();
  const product = {
    id: newProductId(),
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
  // Lote "postado" ainda não anunciado: sai do catálogo até o dono publicá-lo.
  if (announced === false) product.announced = false;

  db.products.unshift(product);
  await writeDb(db);
  res.status(201).json(product);
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
    id: `rev-${crypto.randomUUID()}`,
    author: req.user.name || req.user.propertyOrCompany || 'Produtor Rural',
    authorEmail: req.user.email,
    text: cleanText(String(text).trim().slice(0, 600)),
    rating: Math.min(5, Math.max(0, Number(rating) || 0))
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

// --- Pagamentos (RF04, issue #5) ---
// O pagamento nasce PENDENTE; nada vira "aprovado" sem transição de estado
// válida. Nenhum dado sensível de cartão é aceito, persistido ou logado —
// qualquer campo extra do corpo é descartado na entrada.
app.post('/api/payments', authenticate, async (req, res) => {
  const validation = validatePaymentRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const { items, coupon = null, orderId = null } = req.body;
  const db = await readDb();

  // O total vem SEMPRE do catálogo; se houver pedido vinculado, o valor é o
  // total dele (o cliente não dita o valor).
  let order = null;
  let total;
  if (orderId) {
    order = db.orders.find((o) => o.id === orderId && o.ownerEmail === req.user.email);
    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }
    total = order.total;
  } else {
    const lines = Array.isArray(items)
      ? items.map((item) => ({ product: db.products.find((p) => p.id === String(item?.id)), quantity: Number(item?.quantity) }))
      : [];
    if (!lines.length || lines.some(({ product, quantity }) => !product || !Number.isInteger(quantity) || quantity < 1)) {
      return res.status(400).json({ message: 'Informe itens do catálogo ou o id de um pedido seu.' });
    }
    total = calculateCartSummary(lines.map(({ product, quantity }) => ({ ...product, quantity })), typeof coupon === 'string' ? coupon.toUpperCase() : null).total;
  }

  const payment = {
    id: `pay-${crypto.randomBytes(8).toString('hex')}`,
    ownerEmail: req.user.email,
    orderId: order ? order.id : null,
    method: validation.method,
    installments: validation.installments,
    total,
    status: 'PENDENTE',
    createdAt: new Date().toISOString()
  };

  db.payments = db.payments || [];
  db.payments.unshift(payment);
  await writeDb(db);
  res.status(201).json(payment);
});

app.get('/api/payments/:id', authenticate, async (req, res) => {
  const db = await readDb();
  const payment = (db.payments || []).find((p) => p.id === req.params.id && p.ownerEmail === req.user.email);
  if (!payment) {
    return res.status(404).json({ message: 'Pagamento não encontrado.' });
  }
  res.json(payment);
});

// Transições: confirmar (Pix pago / cartão aprovado / boleto liquidado),
// recusar (cartão) e expirar (Pix/boleto vencidos). A máquina de estados
// (src/services/payment.js) valida cada transição; o pedido vinculado só
// avança para "Pedido Confirmado" quando o pagamento chega a APROVADO.
async function transitionPayment(req, res, to) {
  const db = await readDb();
  const payment = (db.payments || []).find((p) => p.id === req.params.id && p.ownerEmail === req.user.email);
  if (!payment) {
    return res.status(404).json({ message: 'Pagamento não encontrado.' });
  }
  if (!canTransition(payment.status, to)) {
    return res.status(409).json({ message: `Transição inválida: pagamento em ${payment.status} não pode ir para ${to}.` });
  }

  payment.status = to;

  if (to === 'APROVADO' && payment.orderId) {
    const order = db.orders.find((o) => o.id === payment.orderId && o.ownerEmail === req.user.email);
    if (order) {
      order.status = 'Pedido Confirmado';
      order.statusStep = 1;
    }
  }

  await writeDb(db);
  res.json(payment);
}

app.post('/api/payments/:id/confirm', authenticate, (req, res) => transitionPayment(req, res, 'APROVADO'));
app.post('/api/payments/:id/refuse', authenticate, (req, res) => transitionPayment(req, res, 'RECUSADO'));
app.post('/api/payments/:id/expire', authenticate, (req, res) => transitionPayment(req, res, 'EXPIRADO'));

app.get('/api/orders', authenticate, async (req, res) => {
  const db = await readDb();
  // Pedido sem dono (gravado antes desta regra) só aparece para o admin.
  const orders = req.user.role === 'ADMIN' ? db.orders : db.orders.filter((order) => order.ownerEmail === req.user.email);
  res.json(orders);
});

app.post('/api/orders', authenticate, async (req, res) => {
  const { items, coupon = null } = req.body;

  const db = await readDb();
  // Preço e total saem do catálogo e da mesma regra do carrinho (calculateCartSummary), nunca do cliente.
  const lines = Array.isArray(items)
    ? items.map((item) => ({ product: db.products.find((p) => p.id === String(item?.id)), quantity: Number(item?.quantity) }))
    : [];
  if (!lines.length || lines.some(({ product, quantity }) => !product || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000)) {
    return res.status(400).json({ message: 'Itens do pedido inválidos: informe produtos do catálogo e quantidades inteiras maiores que zero.' });
  }
  const orderItems = lines.map(({ product: product, quantity }) => {
    // eslint-disable-next-line no-unused-vars -- comentários, descrição e foto não vão no item do pedido
    const { comments, description, image, ...slim } = product;
    return {
      // O item do pedido não precisa carregar comentários, descrição nem a foto em data URL.
      id: slim.id, name: slim.name, price: slim.price, ownerEmail: slim.ownerEmail, quantity
    };
  });
  const { total } = calculateCartSummary(orderItems, typeof coupon === 'string' ? coupon.toUpperCase() : null);

  const order = {
    id: newOrderId(),
    ownerEmail: req.user.email,
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
  const revenue = db.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  res.json({
    totalUsers: db.users.length,
    totalProducts: db.products.length,
    totalOrders: db.orders.length,
    revenue
  });
});

app.get('/api/admin/users', authenticate, requireAdmin, async (_, res) => {
  const db = await readDb();
  const users = db.users.map(({ id, name, email, role, propertyOrCompany }) => ({ id, name, email, role, propertyOrCompany }));
  res.json(users);
});

// Rota /api que não existe: 404 em JSON, não o index.html com 200 (issue #26). Fica depois de
// todas as rotas de API e antes do fallback da SPA.
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Erro de rota (ex.: db.json ilegível) vira 500 com { message }, sem derrubar o processo.
// O log não guarda o corpo da requisição, onde veio a senha do cliente.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('[agrotech]', error.message);
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' || error.type === 'syntax' ? 400 : 500;
  res.status(status).json({ message: status === 500 ? 'Erro ao acessar os dados do servidor.' : error.message });
});

app.listen(PORT, () => {
  console.log(`AgroTech backend running on http://localhost:${PORT}`);
});
