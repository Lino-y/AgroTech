import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'agrotech-dev-secret';
const dataFile = path.join(__dirname, 'src', 'data', 'db.json');

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
      date: '15/Set/2026',
      status: 'Em trânsito',
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
  ]
};

const signToken = (user) => jwt.sign(
  { sub: user.id, email: user.email, role: user.role },
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
      merged[existingIndex] = {
        ...currentUser,
        ...seedUser,
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

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultDb, null, 2), 'utf8');
    return;
  }

  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    const normalizedDb = {
      users: normalizeDbUsers(parsed.users || defaultDb.users),
      products: parsed.products || defaultDb.products,
      orders: parsed.orders || defaultDb.orders
    };

    if (JSON.stringify(normalizedDb) !== raw) {
      await fs.writeFile(dataFile, JSON.stringify(normalizedDb, null, 2), 'utf8');
    }
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultDb, null, 2), 'utf8');
  }
}

async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    users: normalizeDbUsers(parsed.users || []),
    products: parsed.products || defaultDb.products,
    orders: parsed.orders || defaultDb.orders
  };
}

async function writeDb(db) {
  await ensureDbFile();
  await fs.writeFile(dataFile, JSON.stringify(db, null, 2), 'utf8');
}

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

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await readDb();
    const user = db.users.find((item) => item.id === decoded.sub || item.email === decoded.email);
    if (!user) {
      return res.status(401).json({ message: 'Usuário inexistente para este token.' });
    }

    req.user = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
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
app.use(express.static(__dirname));

app.get('/api/health', (_, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'PRODUTOR', propertyOrCompany = '' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
  }

  const db = await readDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
  }

  const user = {
    id: `usr-${Date.now()}`,
    name: String(name).trim(),
    propertyOrCompany: String(propertyOrCompany).trim(),
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

  user.name = String(name).trim();
  if (propertyOrCompany !== undefined) user.propertyOrCompany = String(propertyOrCompany).trim();
  if (storeProfileImage !== undefined) user.storeProfileImage = String(storeProfileImage || '').trim() || null;
  if (storeCoverImage !== undefined) user.storeCoverImage = String(storeCoverImage || '').trim() || null;
  if (storeBio !== undefined) user.storeBio = String(storeBio || '').slice(0, 500);
  if (storePhone !== undefined) user.storePhone = String(storePhone || '').trim();
  if (storeLocation !== undefined) user.storeLocation = String(storeLocation || '').trim();
  if (storeHours !== undefined) user.storeHours = String(storeHours || '').trim();

  await writeDb(db);
  res.json({ user: sanitizeUser(user) });
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
    certification = 'Emite Nota Fiscal e Certificado MAPA'
  } = req.body;
  if (!name || !price || !category || !description) {
    return res.status(400).json({ message: 'Dados do produto incompletos.' });
  }

  const db = await readDb();
  const product = {
    id: String(Date.now()),
    name: String(name).trim(),
    price: Number(price),
    category: String(category).trim(),
    unit: String(unit).trim(),
    location: String(location).trim(),
    stock: Number(stock),
    shippingType: String(shippingType).trim(),
    certification: String(certification).trim(),
    image: imageUrl || null,
    imageEmoji: category === 'Rações' ? '🐄' : category === 'Fertilizantes' ? '🧪' : category === 'Grãos' ? '🌽' : category === 'Máquinas' ? '🚜' : '📦',
    imageBg: category === 'Rações' ? '#E8F5E9' : category === 'Fertilizantes' ? '#E8F5E9' : category === 'Grãos' ? '#F1F8E9' : category === 'Máquinas' ? '#E0F2F1' : '#F4FBF5',
    rating: 0,
    reviewsCount: 0,
    description: String(description).trim(),
    ownerEmail: req.user.email,
    sellerName: req.user.propertyOrCompany || req.user.name || 'Produtor Rural',
    comments: []
  };

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
    id: `rev-${Date.now()}`,
    author: req.user.name || req.user.propertyOrCompany || 'Produtor Rural',
    authorEmail: req.user.email,
    text: String(text).trim().slice(0, 600),
    rating: Math.min(5, Math.max(0, Number(rating) || 5))
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
  await writeDb(db);
  res.status(201).json(product);
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

app.get('/api/orders', authenticate, async (_, res) => {
  const db = await readDb();
  res.json(db.orders);
});

app.post('/api/orders', authenticate, async (req, res) => {
  const { items = [], total = 0, trackingCode = 'BR-AGRO-' + Date.now() } = req.body;

  const db = await readDb();
  const order = {
    id: `AGT-${Math.floor(10000 + Math.random() * 90000)}`,
    date: 'Hoje',
    status: 'Pedido Confirmado',
    statusStep: 1,
    trackingCode,
    carrier: 'AgroExpress Logística Rural',
    estimatedDelivery: 'Em 3 a 5 dias úteis',
    total: Number(total),
    items,
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

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AgroTech backend running on http://localhost:${PORT}`);
});
