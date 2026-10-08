﻿﻿import { AuthService } from './auth.js';
import { OrderTracker } from './tracker.js';
import { renderFinanceChart } from '../components/FinanceChart.js';
import { buildDefaultProducts, calculateCartSummary, validateCouponCode, COUPON_RULES, VALID_COUPONS } from '../services/commerce.js';
import { addProductToCart, removeProductFromCart, updateCartItemQuantity } from '../services/cart.js';
import { buildProductDraft } from '../services/catalog.js';
import { buildSupportReply } from '../services/support.js';
import { getProducts, getToken, getUser, removeToken, removeUser, setProducts, setToken, setUser } from '../services/storage.js';
import { createOrder, createProduct, deleteProduct as deleteProductApi, loadProducts, loginUser, registerUser, updateStore, addReview, deleteReview } from '../services/api.js';

// --- ÍCONES SVG MINIMALISTAS (linha, monocromáticos, herdam a cor do texto) ---
const ICON_PATHS = {
  // Identidade visual: geometria de 24px, stroke 1.7, cantos arredondados,
  // detalhes secundários com opacity — tudo monocromático herando currentColor.
  catalog: '<path d="M12 3.2v17.6M5.2 8.2l6.8-5 6.8 5M5.2 8.2V19a1.3 1.3 0 0 0 1.3 1.3h11a1.3 1.3 0 0 0 1.3-1.3V8.2"/><path d="M9.4 20.3v-5.2h5.2v5.2"/>',
  finance: '<path d="M3.5 20.5h17M6 20V11.5M11 20V5.5M16 20v-6.5M20.5 20V9"/><path d="M4.5 8l6.5-4 5 3.2 4-2.4" opacity=".45"/>',
  profile: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.5 20.5c.6-4 3.4-6 7.5-6s6.9 2 7.5 6z"/>',
  support: '<path d="M20.5 11.6a7.9 7.9 0 0 1-8 7.9 8.6 8.6 0 0 1-3.2-.6L4.5 20l1.2-3.8a7.6 7.6 0 0 1-1.2-4.6 7.9 7.9 0 0 1 16 0z"/><path d="M8.8 11.6h.01M12 11.6h.01M15.2 11.6h.01" stroke-width="2.1"/>',
  cart: '<path d="M2.5 3.5H5l2.3 11.6a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.6-1.3L21 7.2H5.7"/><circle cx="9.4" cy="20" r="1.5"/><circle cx="17.4" cy="20" r="1.5"/>',
  store: '<path d="M3.4 9.6l1.4-4.4a1.3 1.3 0 0 1 1.2-.9h12a1.3 1.3 0 0 1 1.2.9l1.4 4.4"/><path d="M3.4 9.6h17.2"/><path d="M4.6 9.6v9.2a1.3 1.3 0 0 0 1.3 1.3h12.2a1.3 1.3 0 0 0 1.3-1.3V9.6"/><path d="M9 20.1v-4.2a1.2 1.2 0 0 1 1.2-1.2h3.6a1.2 1.2 0 0 1 1.2 1.2v4.2" opacity=".6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="M20.5 20.5l-4.6-4.6"/><path d="M8 10.8a2.8 2.8 0 0 1 2.8-2.8" opacity=".45"/>',
  pin: '<path d="M12 21.2S5.2 15.8 5.2 10a6.8 6.8 0 0 1 13.6 0c0 5.8-6.8 11.2-6.8 11.2z"/><circle cx="12" cy="9.8" r="2.4"/>',
  box: '<path d="M3.2 7.4L12 3l8.8 4.4v9.2L12 21l-8.8-4.4z"/><path d="M3.2 7.4L12 11.8l8.8-4.4M12 21v-9.2M7.6 5.2l8.8 4.4" opacity=".5"/>',
  truck: '<rect x="1.8" y="6.2" width="12.4" height="9.6" rx="1.4"/><path d="M14.2 9.4h3.9l3 3.2v3.2h-3"/><circle cx="6.2" cy="17.8" r="1.7"/><circle cx="17.2" cy="17.8" r="1.7"/><path d="M7.9 17.8h7.6"/>',
  doc: '<path d="M13.8 3.2H6.8a1.4 1.4 0 0 0-1.4 1.4v14.8a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4V8z"/><path d="M13.8 3.2v4.8h4.8"/><path d="M9 13.2h6M9 16.6h4" opacity=".6"/>',
  clipboard: '<rect x="5" y="4.4" width="14" height="16.4" rx="1.5"/><path d="M9.2 4.4V3h5.6v1.4"/><path d="M9 10.4h6M9 14h4" opacity=".6"/>',
  star: '<path d="M12 3.6l2.7 5.4 5.9.9-4.3 4.2 1 5.9L12 17.2l-5.3 2.8 1-5.9-4.3-4.2 5.9-.9z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.4a.9.9 0 0 1 .9-.9h3.2a.9.9 0 0 1 .9.9V7M6.4 7l.9 12.4a1.3 1.3 0 0 0 1.3 1.2h6.8a1.3 1.3 0 0 0 1.3-1.2L17.6 7"/><path d="M10 11v6M14 11v6" opacity=".6"/>',
  check: '<path d="M4.5 12.5l5 5.2L19.5 6.2"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  bolt: '<path d="M13.2 2.8L4.6 13.8h6.6l-1.2 7.4 8.6-11h-6.6z"/>',
  card: '<rect x="2.4" y="5.2" width="19.2" height="13.6" rx="2"/><path d="M2.4 9.8h19.2"/><path d="M6 14.8h4" opacity=".6"/>',
  tag: '<path d="M3.4 3.4h7.8l9.4 9.4-7.8 7.8-9.4-9.4z"/><circle cx="8" cy="8" r="1.5"/>',
  arrowRight: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
  rocket: '<path d="M5.2 14.8c-1.7 1.7-1.7 4.7-1.7 4.7s3 0 4.7-1.7M12.4 3.6c4.2-1.2 8.2 2.8 7 7-2.2.2-4.6 1.4-6.2 3l-3-3c1.6-1.6 2.8-4.8 3-6.2z"/><circle cx="15.4" cy="8.6" r="1.5"/><path d="M8.6 13.2l2.2 2.2" opacity=".6"/>',
  handshake: '<path d="M2.8 11.8l3.4-3.4 4 4 2.4-2.4 2.4 2.4 4-4 3.4 3.4-5.4 5.4-2.4-2.4-2 2-5.8-5.4z"/>'
};

function icon(name, size = 20, strokeWidth = 1.7) {
  const path = ICON_PATHS[name];
  if (!path) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${path}</svg>`;
}

const authService = new AuthService();
const orderTracker = new OrderTracker();
const savedUser = getUser();

// Verifica se há usuário salvo no localStorage
const initialUser = savedUser || {
  name: '',
  propertyOrCompany: '',
  email: '',
  password: '',
  role: 'PRODUTOR'
};

// --- ESTADO GLOBAL DA APLICAÇÃO ---
const state = {
  activeScreen: 'catalog',
  authMode: 'register',
  selectedCategory: 'Todos',
  selectedProduct: null,
  newRatingStar: 5,
  user: initialUser,
  products: getProducts() || [],
  cart: [],
  orders: [],
  appliedCoupon: null,
  coins: 350,
  profileSection: null,
  storeEditor: null,
  paymentMethod: 'pix',
  creditInstallments: 1,
  financeFilter: 'ALL',
  finance: {
    income: 0,
    expenses: 0,
    chartData: [],
    transactions: []
  },
  chatMessages: [
    { sender: 'bot', text: 'Olá! Sou o assistente AgroTech, disponível 24 horas por dia. Como posso ajudar você hoje?' }
  ],
  // Armazena a tela que o usuário tentou acessar antes do login
  pendingScreen: null
};

window.state = state;

function getCartTotals() {
  return calculateCartSummary(state.cart, state.appliedCoupon);
}

function syncFinanceChartData() {
  // Gráfico 100% baseado em dados reais: transações registradas + pedidos do app.
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  const buckets = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: monthNames[d.getMonth()],
      income: 0,
      expense: 0
    });
  }

  const byKey = new Map(buckets.map(b => [b.key, b]));

  // Pedidos reais feitos no app = saídas
  state.orders.forEach(order => {
    const date = parseOrderDate(order.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (byKey.has(key)) byKey.get(key).expense += Number(order.total || 0);
  });

  // Lançamentos manuais do usuário = entradas/saídas reais
  state.finance.transactions.forEach(tx => {
    const amount = Number(tx.amount || 0);
    if (!amount) return;
    const date = parseOrderDate(tx.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!byKey.has(key)) return;
    if (tx.type === 'INCOME') byKey.get(key).income += amount;
    else byKey.get(key).expense += amount;
  });

  state.finance.chartData = buckets;
}

function parseOrderDate(raw) {
  // Formatos usados: "Hoje", "15/Set/2026", "15/Set às 09:30"
  if (!raw || raw === 'Hoje') return new Date();
  const match = String(raw).match(/(\d{1,2})\/([A-Za-zÀ-ÿ]{3})\/(\d{4})/);
  if (match) {
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const idx = monthNames.indexOf(match[2].toLowerCase().slice(0, 3));
    if (idx >= 0) return new Date(Number(match[3]), idx, Number(match[1]));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function persistProducts() {
  setProducts(state.products);
}

function persistUser() {
  setUser(state.user);
}

function persistToken(token) {
  if (token) setToken(token);
  else removeToken();
}

function showToast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2600);
}

syncFinanceChartData();

// --- NAVEGAÇÃO E LÓGICAS ---
window.navigateTo = function(screen) {
  // Telas que requerem autenticação: apenas compra (carrinho/pagamento) e anúncio de produto
  const authRequiredScreens = ['cart', 'payment', 'sell'];

  // Verifica se o usuário está logado (tem email preenchido)
  const isLoggedIn = state.user && state.user.email && state.user.email.trim() !== '';

  if (authRequiredScreens.includes(screen) && !isLoggedIn) {
    // Armazena a tela que o usuário tentou acessar
    state.pendingScreen = screen;
    // Redireciona para tela de login/registro
    state.activeScreen = 'register';
    state.authMode = 'login'; // Por padrão mostra login, usuário pode alternar para registro
  } else {
    state.activeScreen = screen;
  }

  renderApp();
};

window.toggleAuthMode = function(mode) {
  state.authMode = mode;
  renderApp();
};

window.applyCategoryFilter = function(category) {
  state.selectedCategory = category;
  renderApp();
};

window.applySearchFilter = function() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  const term = input.value.toLowerCase();

  const productCards = document.querySelectorAll('.product-card');
  productCards.forEach(card => {
    const title = card.getAttribute('data-title').toLowerCase();
    const category = card.getAttribute('data-category').toLowerCase();
    card.style.display = (title.includes(term) || category.includes(term)) ? 'flex' : 'none';
  });
};

window.openProductDetail = function(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (prod) {
    state.selectedProduct = prod;
    state.newRatingStar = 5;
    renderApp();
  }
};

window.closeProductDetail = function() {
  state.selectedProduct = null;
  renderApp();
};

window.setNewRatingStar = function(starCount) {
  state.newRatingStar = starCount;
  renderApp();
};

window.submitReview = function(event) {
  event.preventDefault();
  const commentText = document.getElementById('reviewText').value.trim();
  if (!commentText || !state.selectedProduct) return;

  const authorName = state.user.name || state.user.propertyOrCompany || 'Produtor Rural';

  state.selectedProduct.comments.unshift({
    author: authorName,
    text: commentText,
    rating: state.newRatingStar
  });

  const totalStars = state.selectedProduct.comments.reduce((acc, c) => acc + c.rating, 0);
  state.selectedProduct.reviewsCount = state.selectedProduct.comments.length;
  state.selectedProduct.rating = parseFloat((totalStars / state.selectedProduct.reviewsCount).toFixed(1));

  persistProducts();
  showToast('Agradecemos sua avaliação!', 'success');
  renderApp();
};

// --- IA ASSISTENTE DE ANÚNCIO ---
// Analisa a descrição livre do vendedor e preenche os campos do formulário.
// Funciona localmente (sem chaves de API): reconhece palavras-chave agro
// e estima preço/unidade/categoria a partir do texto.
const AI_KEYWORDS = [
  { match: ['milho', 'soja', 'semente', 'trigo', 'arroz', 'feijão', 'grão', 'café', 'algodão', 'sorgo'], category: 'Grãos', unit: 'kg', price: 320, desc: 'Lote de sementes/grãos com certificação de origem. Ideal para plantio na safra atual, com laudo de germinação e embalagem original.' },
  { match: ['npk', 'adubo', 'fertilizante', 'ureia', 'calcário', 'nitrogênio', 'fósforo', 'potássio'], category: 'Fertilizantes', unit: 'kg', price: 185, desc: 'Fertilizante granulado de alta solubilidade, formulação balanceada para formação radicular vigorosa. Entrega imediata em carretas fechadas.' },
  { match: ['racao', 'ração', 'nutrição', 'confinamento', 'bovino', 'suíno', 'aves', 'sal mineral'], category: 'Rações', unit: 'kg', price: 92, desc: 'Alimento concentrado balanceado para engorda intensiva, com excelente conversão alimentar e minerais quelatados.' },
  { match: ['trator', 'colheitadeira', 'máquina', 'pulverizador', 'implemento', 'arado', 'grade', 'plantadeira', 'carreta'], category: 'Máquinas', unit: 'unidade', price: 750, desc: 'Equipamento revisado com manutenção em dia, pronto para uso no preparo de solo e operações de campo. Operador disponível.' },
  { match: ['herbicida', 'agrotóxico', 'defensivo', 'inseticida', 'fungicida', 'glyphosate', 'glifosato'], category: 'Outros', unit: 'unidade', price: 45, desc: 'Produto registrado no MAPA, com bula e receita agronômica. Embalagem lacrada, lote recente.' }
];

// Nomes comerciais para o título do anúncio (o maior match ganha)
// Nomes comerciais para o título do anúncio (o maior match ganha)
const PRODUCT_NAMES = [
  { match: 'milho', name: 'Milho Híbrido' },
  { match: 'soja', name: 'Semente de Soja' },
  { match: 'trigo', name: 'Trigo' },
  { match: 'arroz', name: 'Arroz' },
  { match: 'feijão', name: 'Feijão' },
  { match: 'café', name: 'Café' },
  { match: 'algodão', name: 'Algodão' },
  { match: 'sorgo', name: 'Sorgo' },
  { match: 'npk', name: 'Adubo NPK' },
  { match: 'ureia', name: 'Ureia' },
  { match: 'calcário', name: 'Calcário' },
  { match: 'racao', name: 'Ração' },
  { match: 'ração', name: 'Ração' },
  { match: 'sal mineral', name: 'Sal Mineral' },
  { match: 'trator', name: 'Trator' },
  { match: 'colheitadeira', name: 'Colheitadeira' },
  { match: 'pulverizador', name: 'Pulverizador' },
  { match: 'plantadeira', name: 'Plantadeira' },
  { match: 'carreta', name: 'Carreta' },
  { match: 'herbicida', name: 'Herbicida' },
  { match: 'glifosato', name: 'Glifosato' },
  { match: 'glyphosate', name: 'Glifosato' },
  { match: 'inseticida', name: 'Inseticida' },
  { match: 'fungicida', name: 'Fungicida' }
];

// Unidades que podem ser citadas como "o kg", "a tonelada"...
const UNIT_ALIASES = [
  { match: /\b(kg|quilo|quilos)\b/, unit: 'kg' },
  { match: /\b(toneladas?|ton)\b/, unit: 'tonelada' },
  { match: /\b(unidades?|cabe[cç]as?)\b/, unit: 'unidade' }
];

// --- FUNÇÃO PARA GERAR DETALHES TÉCNICOS POR CATEGORIA ---
function getTechnicalDetails(category, prompt) {
  const details = {
    'Grãos': [
      '**QUALIDADE GARANTIDA PARA ALTA PRODUTIVIDADE**',
      '• Sementes certificadas MAPA — pureza varietal ≥ 98%, germinação ≥ 90% (laudo anexo)',
      '• Tratamento industrial premium: fungicida sistêmico + inseticida + polímero colorido (rastreabilidade visual)',
      '• Umidade controlada 12-14% — prontas para plantio imediato, sem necessidade de secagem',
      '• Vigor testado: tetrazólio e envelhecimento acelerado — emergência rápida e uniforme no campo',
      '• Isentas de sementes de plantas daninhas quarentenárias (ex: amaranto, caruru, trapoeraba)',
      '• Embalagem rastreável: sacos 60kg ráfia laminada ou Big Bag 1.000kg com QR Code do lote',
      '• Validade do tratamento: 120 dias — proteção na fase crítica de estabelecimento da lavoura',
      '• Recomendação técnica: profundidade 3-5cm, velocidade 5-7 km/h, adubação de base conforme análise de solo',
      '• Janela de plantio otimizada para sua região — consulte nosso calendário safra 2026/27',
      '**DIFERENCIAL**: Lote com rastreabilidade total do campo à saca — transparência que valoriza sua colheita'
    ],
    'Fertilizantes': [
      '**NUTRIÇÃO INTELIGENTE PARA SOLO PRODUTIVO**',
      '• Formulação NPK personalizada: balanceada conforme sua análise de solo (envie seu laudo para ajuste fino)',
      '• Granulometria premium 2-4mm (SGN 200-300) — distribuição uniforme, sem segregação na lançadeira',
      '• Alta solubilidade (>95%) — nutrientes disponíveis na solução do solo desde o 1º dia',
      '• Tecnologia de revestimento: menor perdas por volatilização (N) e fixação (P) — maior eficiência',
      '• Enriquecido com micronutrientes quelatados (Zn, B, Cu, Mn, Mo) — previne deficiências ocultas',
      '• Baixo teor de cloretos e biureto — seguro para culturas sensíveis (soja, feijão, citros)',
      '• Embalagem tecnológica: sacos 50kg barreira UV + Big Bag 1.000kg com liner interno — integridade total',
      '• Livre de contaminantes: metais pesados (Cd, Pb, As, Hg) muito abaixo dos limites MAPA/ANVISA',
      '• Rastreabilidade: QR Code no saco com certificado de análise, data de fabricação e lote',
      '**DIFERENCIAL**: Programa de devolução de embalagens vazias (logística reversa) — sustentabilidade que conta pontos no CAR'
    ],
    'Rações': [
      '**NUTRIÇÃO DE PRECISÃO PARA MÁXIMA CONVERSÃO ALIMENTAR**',
      '• Fórmula exclusiva desenvolvida por zootecnista — energia, proteína, fibra e minerais na medida exata',
      '• Matérias-primas nobres: milho flocado, farelo de soja 48% toasted, núcleo mineral/vitamínico premium',
      '• Proteína bruta ajustada: 16-22% (bovinos corte), 18-20% (leite), 20-24% (suínos/aves) — sem desperdício',
      '• FDN otimizado (35-45%) — ruminação saudável, pH ruminal estável, zero acidose/subaguda',
      '• Aditivos de performance: ionóforo (monensina/lasalocida) + levedura viva + enzimas fibrolíticas',
      '• Peletização 4-6mm (durabilidade > 95%) — menos farelo no cocho, melhor aproveitamento',
      '• Controle rigoroso de micotoxinas: aflatoxina < 20 ppb, fumonisina < 5 ppm, zearalenona < 500 ppb',
      '• Embalagem inviolável: sacos 30-40kg tripla camada ou Big Bag com atmosfera modificada',
      '• Validade real: 180 dias (farelo) a 12 meses (peletizada) — frescor garantido na entrega',
      '**DIFERENCIAL**: Acompanhamento nutricional gratuito — ajustamos a fórmula conforme fase do rebanho e resultados de pesagem'
    ],
    'Máquinas': [
      '**POTÊNCIA E CONFIABILIDADE PARA SUA OPERAÇÃO**',
      '• Revisão completa 210 pontos: motor, transmissão, hidráulica, direção, freios, cabina, elétrica, pneus/esteiras',
      '• Horímetro certificado: leitura real, sem adulteração — histórico de manutenção documentado',
      '• Troca de todos os fluidos e filtros (óleo motor, hidráulico, transmissão, ar, combustível, ar condicionado)',
      '• Implementos homologados: plantadeira (linha/taxa variável), pulverizador (barras 24-36m), carreta (3 eixos)',
      '• Tecnologia embarcada: piloto automático RTK, telemetria, monitor de plantio/pulverização (opcional)',
      '• Documentação em dia: NF aquisição, manual operador, CAT, ART de inspeção, seguro RCTR-C',
      '• Operador certificado NR-11/12 incluso na diária — você foca na gestão, nós operamos com segurança',
      '• Disponibilidade 98%: frota reserva estratégica — sua operação não para por quebra',
      '• Logística própria: transporte em prancha baixa, escolta se necessário, entrega na porteira da fazenda',
      '**DIFERENCIAL**: Contrato flexível — diária, hectare ou safra completa. Cláusula de performance: se não render, não paga'
    ],
    'Outros': [
      '**PROTEÇÃO DA LAVOURA COM TECNOLOGIA E RESPONSABILIDADE**',
      '• Produto registrado MAPA/ANVISA/IBAMA — número de registro no rótulo, consulta pública no Agrofit',
      '• Ingrediente ativo de última geração: concentração garantida, pureza técnica > 97%',
      '• Formulação avançada: CE (emulsionável), SC (suspensão), WG (grânulos dispersíveis), OD (dispersão óleo-água)',
      '• Perfil toxicológico favorável: Classe III/IV (pouco tóxico) — EPI padrão, carência curta, menor risco ao aplicador',
      '• Classe ambiental: baixo risco à fauna aquática e abelhas (quando aplicado corretamente — siga a bula!)',
      '• Embalagens certificadas: tríplice lavagem + inutilização + destinação final rastreável (inpEV)',
      '• Lote com rastreabilidade 4.0: QR Code com FISPQ, bula, certificado de análise, receita agronômica digital',
      '• Validade 24-36 meses — estoque fresco, rotação FIFO garantida no nosso CD',
      '• Receita agronômica digital assinada por Eng. Agrônomo (CREA ativo) — emissão em 24h via app',
      '**DIFERENCIAL**: Programa Manejo Integrado — recomendamos rotação de MoA, refugio, monitoramento de pragas. Resultado: menor custo/ha, maior sustentabilidade'
    ]
  };

  const categoryDetails = details[category];
  if (!categoryDetails) return null;

  // Extrai informações específicas do prompt para personalizar
  const customLines = [];

  // Extrai variedade/cultivar se mencionada
  const varietyMatch = prompt.match(/(cultivar|variedade|híbrido|híbrida)\s+([a-zá-ú0-9\s\-]+)/i);
  if (varietyMatch && category === 'Grãos') {
    customLines.unshift(`• Cultivar/Variedade: ${varietyMatch[2].trim().toUpperCase()}`);
  }

  // Extrai formulação NPK se mencionada
  const npkMatch = prompt.match(/(\d{1,2}[-\s]?\d{1,2}[-\s]?\d{1,2})/);
  if (npkMatch && category === 'Fertilizantes') {
    customLines.unshift(`• Formulação NPK: ${npkMatch[1].replace(/\s/g, '-')}`);
  }

  // Extrai ingrediente ativo se mencionado
  const activeMatch = prompt.match(/(glifosato|2,4-d|dicamba|atrazina|clomazone|sulfentrazone|imazetapir|tebuconazol|azoxistrobina|picoxistrobina|cipermetrina|lambda-cialotrina|bifentrina)/i);
  if (activeMatch && category === 'Outros') {
    customLines.unshift(`• Ingrediente ativo principal: ${activeMatch[1].toUpperCase()}`);
  }

  // Extrai marca/modelo para máquinas
  const modelMatch = prompt.match(/(john deere|massey|new holland|case|valtra|agrale|stara|jacto|kuhn|baldan|marchesan)\s+([a-z0-9\s\-]+)/i);
  if (modelMatch && category === 'Máquinas') {
    customLines.unshift(`• Marca/Modelo: ${modelMatch[1].toUpperCase()} ${modelMatch[2].trim().toUpperCase()}`);
  }

  const allLines = [...customLines, ...categoryDetails];
  return allLines.join('\n');
}

// --- FUNÇÃO PARA GERAR DESCRIÇÃO CRIATIVA DE MARKETING ---
function generateCreativeDescription(name, category, prompt, price, unit, stock, location) {
  const lowerPrompt = prompt.toLowerCase();
  const city = location ? location.split(' - ')[0] : 'nossa fazenda';

  // Extrai palavras-chave de qualidade/valor do prompt
  const qualityKeywords = [];
  if (/selecionad[ao]|escolhid[ao]|premium|especial|gourmet|artesanal/.test(lowerPrompt)) qualityKeywords.push('selecionados com rigor');
  if (/m[ãa]o|manual|artesanal/.test(lowerPrompt)) qualityKeywords.push('colhidos/processados à mão');
  if (/melhor|excelente|ótimo|superior|primeira|top/.test(lowerPrompt)) qualityKeywords.push('qualidade superior');
  if (/preço|barato|acessível|justo|competitiv[ao]|promoção|oferta/.test(lowerPrompt)) qualityKeywords.push('preço imbatível');
  if (/fresco|recente|nova safra|safra atual/.test(lowerPrompt)) qualityKeywords.push('safra fresca');
  if (/orgânico|agroecológico|natural|sem agrotóxico/.test(lowerPrompt)) qualityKeywords.push('produção natural');
  if (/tradicional|herança|família|avô|pai|geração/.test(lowerPrompt)) qualityKeywords.push('tradição familiar');
  if (/sustentável|regenerativo|carbono|preservação/.test(lowerPrompt)) qualityKeywords.push('agricultura regenerativa');

  const qualityPhrase = qualityKeywords.length
    ? qualityKeywords.slice(0, 3).join(', ')
    : 'qualidade comprovada';

  // Templates criativos por categoria
  const templates = {
    'Grãos': [
      `${name}: grãos ${qualityPhrase}, direto da ${city} para seu plantio.`,
      `Sementes de ${name.toLowerCase()} — ${qualityPhrase}, germinação vigorosa, lavoura uniforme.`,
      `Lote especial de ${name.toLowerCase()}: ${qualityPhrase}, pureza varietal garantida, pronto para render.`
    ],
    'Fertilizantes': [
      `${name}: fertilizante ${qualityPhrase}, nutrição precisa para sua lavoura render mais.`,
      `Adubo ${name.toLowerCase()} — ${qualityPhrase}, solubilidade total, raiz forte desde o início.`,
      `${name}: a escolha certa para quem busca ${qualityPhrase} e custo-benefício real no hectare.`
    ],
    'Rações': [
      `${name}: ração ${qualityPhrase}, formulada para conversão alimentar máxima e lucro no bolso.`,
      `Nutrição animal com ${name.toLowerCase()} — ${qualityPhrase}, animais saudáveis, produção recorde.`,
      `Ração premium ${name}: ${qualityPhrase}, palatabilidade irresistível, ganho de peso consistente.`
    ],
    'Máquinas': [
      `${name}: máquina ${qualityPhrase}, revisada e pronta para trabalhar na sua fazenda.`,
      `Equipamento ${name.toLowerCase()} — ${qualityPhrase}, operador incluso, produtividade garantida.`,
      `Locação de ${name}: ${qualityPhrase}, tecnologia de ponta, custo por hectare imbatível.`
    ],
    'Outros': [
      `${name}: insumo ${qualityPhrase}, eficácia comprovada no controle, segurança na aplicação.`,
      `${name.toLowerCase()} — ${qualityPhrase}, tecnologia de ponta, resultado visível na lavoura.`,
      `Defensivo ${name}: ${qualityPhrase}, manejo inteligente, proteção que rende mais.`
    ]
  };

  const categoryTemplates = templates[category] || templates['Outros'];
  const baseDesc = categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];

  // Adiciona detalhes contextuais se disponíveis
  const details = [];
  if (price && unit) details.push(`R$ ${price.toFixed(2)}/${unit}`);
  if (stock) details.push(`${stock} ${unit || 'unidades'} disponíveis`);
  if (location) details.push(`Origem: ${city}`);

  const detailStr = details.length ? ` | ${details.join(' • ')}` : '';

  return `${baseDesc}${detailStr}\n\nEntre em contato para fechar negócio direto com o produtor!`;
}

window.aiFillProduct = function() {
  const promptEl = document.getElementById('aiPrompt');
  if (!promptEl) return;
  const prompt = promptEl.value.trim().toLowerCase();

  if (!prompt || prompt.length < 5) {
    showToast('Descreva o que você quer anunciar para a IA preencher.', 'error');
    return;
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  // Detecta a categoria pelas palavras-chave (com pontuação: mais matches = mais confiável)
  const scored = AI_KEYWORDS
    .map(k => ({ ...k, score: k.match.filter(word => prompt.includes(word)).length }))
    .filter(k => k.score > 0)
    .sort((a, b) => b.score - a.score);
  const found = scored[0] || null;

  // Preço: aceita "R$ 250,50", "250 reais", "por 250", "a 250", "vender por 250"
  let price = null;
  const priceMatch = prompt.match(/r\$\s*(\d{1,6}(?:[.,]\d{1,2})?)|(\d{1,6}(?:[.,]\d{1,2})?)\s*reais|por\s+r?\$?\s*(\d{1,6}(?:[.,]\d{1,2})?)/);
  if (priceMatch) {
    const raw = (priceMatch[1] || priceMatch[2] || priceMatch[3] || '').replace(',', '.');
    price = parseFloat(raw);
    if (!price || price <= 0 || price > 1000000) price = null;
  }

  // Quantidade: "40 toneladas" OU "467 de estoque", "467 kg disponíveis"
  let stock = null;
  let quotedUnit = null;
  const stockMatch = prompt.match(/(\d[\d.,]*)\s*(unidades?|toneladas?|tons?|cabe[cç]as?|kg|quilos?)/);
  const stockDeMatch = prompt.match(/(\d[\d.,]*)\s*(?:de\s*)?(?:estoque|dispon(?:i|í)ve(?:l|is)|em\s*estoque)/);
  if (stockMatch) {
    stock = parseInt(stockMatch[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'), 10) || null;
    const u = stockMatch[2];
    if (/^ton/.test(u)) quotedUnit = 'tonelada';
    else if (/^cabe/.test(u)) quotedUnit = 'unidade';
    else if (/^unid/.test(u)) quotedUnit = 'unidade';
    else if (/^(kg|quilo)/.test(u)) quotedUnit = 'kg';
  } else if (stockDeMatch) {
    stock = parseInt(stockDeMatch[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'), 10) || null;
  }

  // Unidade: prioriza a citada junto da quantidade; senão "o kg";
  // senão deduz do texto; senão usa a da categoria detectada.
  const unit = quotedUnit
    || (() => { const hit = UNIT_ALIASES.find(a => a.match.test(prompt)); return hit ? hit.unit : null; })()
    || (/(granel)/.test(prompt) ? 'tonelada' : null)
    || (found ? found.unit : null);

  const category = found ? found.category : null;

  // Localização: "Cidade - UF" (hífen) OU "em Cidade" / "em <palavra>" no final do texto
  // (ex: "... arcórz mg", "... disponível na fazenda em Arcos MG").
  // Fallback "em Cidade" só aceita palavras com 4+ letras para não capturar ruído.
  let location = null;
  const locMatch =
    prompt.match(/\b([a-zá-ú]{3,20}(?:\s[a-zá-ú]{3,20})?)\s*[-–]\s*([a-z]{2})\b/) ||
    prompt.match(/(?:em|região de)\s+([a-zá-ú]{3,20}(?:\s[a-zá-ú]{3,20})?)\s*[-–,]\s*([a-z]{2})\b/) ||
    prompt.match(/\b([a-zá-ú]{4,20})\s+([a-z]{2})\b(?=\s*[,.;]|$)/) ||
    prompt.match(/(?:em|de)\s+([a-zá-ú]{4,20})\s+([a-z]{2})\s*(?:[,.;]|$)/);
  const BRAZILIAN_UFS = /^(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)$/;
  if (locMatch) {
    const city = locMatch[1].trim();
    const uf = locMatch[2].toLowerCase();
    const words = city.split(/\s+/);
    const valid = BRAZILIAN_UFS.test(uf) && !/\d/.test(city) && words.every(w => w.length >= 3) && !/^(mapa|laudo|nfe|nf|estoque|reais)$/.test(city.split(/\s+/).pop());
    if (valid) {
      location = `${city.replace(/\b\w/g, c => c.toUpperCase())} - ${uf.toUpperCase()}`;
    }
  }

  // Certificação / documentação citada no texto
  let cert = null;
  const certParts = [];
  if (/mapa/.test(prompt)) certParts.push('Registro MAPA');
  if (/nf-e|nota fiscal eletrônica|nfe|nota fiscal/.test(prompt)) certParts.push('Emite NF-e');
  if (/laudo/.test(prompt)) certParts.push('Laudo de análise');
  if (/orgânic|organico/.test(prompt)) certParts.push('Certificação orgânica');
  if (/certificad/.test(prompt)) certParts.push('Certificado de origem');
  if (certParts.length) cert = certParts.join(' • ');

  // Título: usa o nome comercial do produto detectado; sem produto, usa o
  // texto do produtor limpo (sem preços/quantidades), máx. 6 palavras.
  let name = null;
  let matchedProducts = PRODUCT_NAMES
    .filter(p => prompt.includes(p.match))
    .sort((a, b) => b.match.length - a.match.length);
  if (matchedProducts.length) {
    // pega a palavra do produto + possíveis qualificadores seguintes (marca/modelo/tipo)
    // ex: "café pilão" -> "Café Pilão"; "trator 4x4" -> "Trator 4x4"
    const firstWord = matchedProducts[0].match;
    const idx = prompt.indexOf(firstWord);
    const after = prompt.slice(idx + firstWord.length).trim();
    const nextTokens = after.split(/\s+/).slice(0, 2).map(t => t.replace(/[^a-zá-ú\dx]+$/i, '')).filter(t =>
      t.length >= 2 && /^[a-zá-ú][a-zá-ú\dx]*$/i.test(t) &&
      !/^(r\$|\d|reais|por|a|o|em|com|de|estoque|kg|toneladas?|unidades?)$/.test(t)
    );
    name = [firstWord, ...nextTokens].join(' ').replace(/(^|\s)(\S)/g, (m, p1, p2) => p1 + p2.toUpperCase());
    if (matchedProducts.length > 1 && matchedProducts[1].name !== matchedProducts[0].name) {
      name += ` + ${matchedProducts[1].name}`;
    }
  } else {
    const cleaned = prompt
        .replace(/(?:r\$\s*)?\d[\d.,]*/g, ' ') // remove preços e quantidades
        .replace(/\b(reais|por|a|em|com|unidades?|toneladas?)\b/g, (m, w) => /\b(a|em|com|por)\b/.test(m) ? m : ' ')
        .split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
    if (cleaned.length >= 3) {
      name = cleaned.replace(/(^|\s)([a-zá-ú])/g, (m, p1, p2) => p1 + p2.toUpperCase());
    }
  }
  if (!name) name = 'Anúncio AgroTech';

  // Descrição: se o produtor pediu para "criar/gerar descrição", monta uma ficha
  // técnica a partir dos dados extraídos; senão cria descrição criativa de marketing.
  const wantsGenerated = /crie|criar|gere|gerar|fa[zç]a?|monte|montar|escreva|escrever/.test(prompt) && /descri/.test(prompt);
  const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  let desc;
  if (wantsGenerated) {
    const lines = [];
    if (name) lines.push(`Produto: ${name}`);
    if (category) lines.push(`Categoria: ${category}`);
    if (price) lines.push(`Preço de referência: R$ ${price.toFixed(2)}${unit ? ` por ${unit}` : ''}`);
    if (stock) lines.push(`Estoque disponível: ${stock}${unit ? ` ${unit}` : ''}`);
    if (location) lines.push(`Origem: ${location}`);
    if (cert) lines.push(`Documentação: ${cert}`);

    // Descrição técnica detalhada por categoria
    const techDetails = getTechnicalDetails(category, prompt);
    if (techDetails) lines.push(`\n--- FICHA TÉCNICA ---\n${techDetails}`);

    const rawWanted = prompt.replace(/,?\s*crie?\s*(?:uma\s*)?descri[cç][ãa]o(?:\s*por\s*favor)?\s*$/i, '').trim();
    if (rawWanted && rawWanted.length > 5) lines.push(`\nObservações do produtor: ${rawWanted}`);
    lines.push('\nEntre em contato para negociar condições, frete e pagamento.');
    desc = lines.join('\n');
  } else {
    // Descrição criativa de marketing baseada na categoria e info extraída
    desc = generateCreativeDescription(name, category, prompt, price, unit, stock, location);
  }

  // Só preenche o que a IA conseguiu inferir; o resto fica em branco
  setVal('prodName', name);
  if (price) setVal('prodPrice', price.toFixed(2));
  if (unit) setVal('prodUnit', unit);
  if (category) setVal('prodCategory', category);
  if (stock) setVal('prodStock', stock);
  if (location) setVal('prodLocation', location);
  if (cert) setVal('prodCert', cert);
  setVal('prodDesc', desc);

  const filled = [name && 'título', price && 'preço', unit && 'unidade', category && 'categoria', stock && 'estoque', location && 'cidade', cert && 'certificação'].filter(Boolean);
  showToast(filled.length > 1
    ? `IA preencheu: ${filled.join(', ')}. Complete os campos em branco antes de publicar.`
    : 'IA extraiu poucas informações do texto — complete os demais campos.', 'success');
};

// --- PUBLICAÇÃO DO ANÚNCIO ---
window.handlePublishProduct = async function(event) {
  event.preventDefault();

  const name = document.getElementById('prodName')?.value.trim();
  const price = parseFloat(document.getElementById('prodPrice')?.value);
  const unit = document.getElementById('prodUnit')?.value;
  const category = document.getElementById('prodCategory')?.value;
  const stock = parseInt(document.getElementById('prodStock')?.value, 10);
  const location = document.getElementById('prodLocation')?.value.trim();
  const shippingType = document.getElementById('prodShippingType')?.value;
  const certification = document.getElementById('prodCert')?.value.trim();
  const imageUrl = document.getElementById('prodImage')?.value || '';
  const description = document.getElementById('prodDesc')?.value.trim();

  if (!name || !description || isNaN(price) || price <= 0 || isNaN(stock) || stock <= 0) {
    showToast('Preencha título, preço, estoque e descrição antes de publicar.', 'error');
    return;
  }

  const draft = buildProductDraft({
    name,
    price,
    unit,
    category,
    stock,
    location,
    shippingType,
    certification,
    imageUrl,
    description,
    userName: state.user.name || state.user.propertyOrCompany,
    userEmail: state.user.email
  });

  try {
    const saved = await createProduct(draft);
    state.products.unshift(saved || draft);
    persistProducts();
    showToast('Anúncio publicado no mercado AgroTech!', 'success');
    state.activeScreen = 'catalog';
    renderApp();
  } catch (error) {
    // Sem backend: mantém o anúncio localmente para não perder o trabalho
    state.products.unshift(draft);
    persistProducts();
    showToast('Anúncio publicado (salvo localmente).', 'success');
    state.activeScreen = 'catalog';
    renderApp();
  }
};

// --- UPLOAD DE FOTO DO LOTE ---
window.handleProductImageUpload = function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Selecione um arquivo de imagem (JPG, PNG, etc).', 'error');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    showToast('Imagem muito grande. Máximo de 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const input = document.getElementById('prodImage');
    if (input) input.value = dataUrl;
    const preview = document.getElementById('prodImagePreview');
    if (preview) {
      preview.src = dataUrl;
      preview.style.display = 'block';
    }
    showToast('Foto do lote carregada!', 'success');
  };
  reader.readAsDataURL(file);
};
window.deleteProduct = function(productId) {
  if (!confirm('Deseja realmente excluir este produto do catálogo?')) return;

  state.products = state.products.filter(p => p.id !== productId);
  persistProducts();
  state.selectedProduct = null;
  showToast('Produto excluído com sucesso.', 'success');
  renderApp();

  // Sincroniza a exclusão no servidor (produtos salvos em db.json)
  deleteProductApi(productId)
    .catch((error) => {
      console.warn('Não foi possível excluir no servidor:', error.message);
      showToast('O produto foi removido aqui, mas pode reaparecer ao recarregar.', 'error');
    });
};

window.toggleProfileSection = function(section) {
  state.profileSection = state.profileSection === section ? null : section;
  renderApp();
};

window.toggleFavorite = function(productId) {
  if (!state.user.favorites) state.user.favorites = [];
  const idx = state.user.favorites.indexOf(productId);
  if (idx >= 0) {
    state.user.favorites.splice(idx, 1);
    showToast('Removido dos favoritos.', 'info');
  } else {
    state.user.favorites.push(productId);
    showToast('⭐ Adicionado aos favoritos!', 'success');
  }
  persistUser();
  renderApp();
};

window.buyAgain = function(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || !order.items || !order.items.length) {
    showToast('Nenhum item anterior para recomprar.', 'info');
    return;
  }
  let added = 0;
  order.items.forEach(it => {
    const prod = state.products.find(p => p.id === it.id || p.name === it.name);
    if (prod) {
      state.cart = addProductToCart(state.cart, prod);
      added++;
    }
  });
  if (added) {
    showToast(`${added} item(ns) adicionados ao carrinho!`, 'success');
    state.activeScreen = 'cart';
  } else {
    showToast('Os itens desse pedido não estão mais no catálogo.', 'info');
    state.activeScreen = 'catalog';
  }
  renderApp();
};

window.addToCart = function(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  state.cart = addProductToCart(state.cart, prod);
  showToast(`${prod.name} adicionado ao carrinho!`, 'info');
  renderApp();
};

window.removeFromCart = function(productId) {
  state.cart = removeProductFromCart(state.cart, productId);
  renderApp();
};

window.changeCartQuantity = function(productId, delta) {
  state.cart = updateCartItemQuantity(state.cart, productId, delta);
  renderApp();
};

window.removeAppliedCoupon = function() {
  state.appliedCoupon = null;
  showToast('Cupom removido.', 'info');
  renderApp();
};

window.copyCoupon = function(code) {
  const input = document.getElementById('couponInput');
  if (input) input.value = code;
  window.applyCoupon();
};

window.applyCoupon = function() {
  const codeInput = document.getElementById('couponInput');
  if (!codeInput) return;
  const code = codeInput.value.trim().toUpperCase();

  const totals = calculateCartSummary(state.cart, null);
  const validation = validateCouponCode(code, totals.subtotal);

  if (validation.valid) {
    state.appliedCoupon = validation.coupon;
    showToast(`Cupom ${validation.coupon} aplicado com sucesso!`, 'success');
  } else {
    showToast(validation.message, 'error');
  }
  renderApp();
};

window.setPaymentMethod = function(method) {
  state.paymentMethod = method;
  renderApp();
};

window.setCreditInstallments = function(inst) {
  state.creditInstallments = Number(inst || 1);
  renderApp();
};

window.processPayment = async function(event) {
  if (event) event.preventDefault();

  if (!state.cart.length) {
    showToast('Seu carrinho está vazio.', 'error');
    return;
  }

  const totals = getCartTotals();

  try {
    const newOrder = await createOrder({
      items: state.cart.map(item => ({ ...item })),
      total: totals.total,
      trackingCode: `BR-AGRO-${Math.floor(100000 + Math.random() * 900000)}-X`,
      coupon: state.appliedCoupon,
      paymentMethod: state.paymentMethod,
      shipping: totals.shipping
    });

    state.orders.unshift(newOrder);
    state.coins += Math.round(totals.total / 10); // 1 moeda a cada R$ 10
    state.finance.expenses += totals.total;
    state.finance.transactions.unshift({
      id: Date.now(),
      title: `📦 Compra no App (${newOrder.id})`,
      amount: totals.total,
      type: 'EXPENSE',
      date: 'Hoje'
    });

    syncFinanceChartData();

    showToast(`Pagamento de R$ ${totals.total.toFixed(2)} aprovado!`, 'success');
    state.cart = [];
    state.appliedCoupon = null;
    state.activeScreen = 'orders';
    renderApp();
  } catch (error) {
    showToast(error.message || 'Não foi possível confirmar o pagamento.', 'error');
  }
};

window.setFinanceFilter = function(filter) {
  state.financeFilter = filter;
  renderApp();
};

window.setTransactionType = function(type) {
  const input = document.getElementById('txType');
  if (!input) return;
  input.value = type;

  const buttons = document.querySelectorAll('[data-tx-type]');
  buttons.forEach((button) => {
    const isActive = button.dataset.txType === type;
    button.style.background = isActive ? '#2E7D32' : '#F4FBF7';
    button.style.color = isActive ? '#FFFFFF' : '#1B5E20';
    button.style.borderColor = isActive ? '#2E7D32' : '#C8E6C9';
  });
};

window.handleAddTransaction = function(event) {
  event.preventDefault();
  const title = document.getElementById('txTitle').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const type = document.getElementById('txType').value;

  if (title && amount > 0) {
    if (type === 'INCOME') {
      state.finance.income += amount;
      state.finance.transactions.unshift({
        id: Date.now(),
        title: `Venda: ${title}`,
        amount,
        type: 'INCOME',
        date: 'Hoje'
      });
    } else {
      state.finance.expenses += amount;
      state.finance.transactions.unshift({
        id: Date.now(),
        title: `💸 ${title}`,
        amount,
        type: 'EXPENSE',
        date: 'Hoje'
      });
    }

    syncFinanceChartData();

    showToast('Lançamento registrado com sucesso!', 'success');
    renderApp();
  }
};

window.sendChatMessage = function(customText) {
  const input = document.getElementById('chatInput');
  const userText = customText || (input ? input.value.trim() : '');

  if (!userText) return;

  state.chatMessages.push({ sender: 'user', text: userText });
  if (input && !customText) input.value = '';

  const reply = buildSupportReply(userText, state.user);
  state.chatMessages.push({ sender: 'bot', text: reply.text });

  if (reply.nextScreen) {
    setTimeout(() => window.navigateTo(reply.nextScreen), 1200);
  }

  renderApp();
};

window.activeTrackingTimers = window.activeTrackingTimers || {};

window.simulateOrderStep = function(orderId) {
  const index = state.orders.findIndex(o => o.id === orderId);
  if (index >= 0) {
    const updated = orderTracker.advanceOrder(state.orders[index]);
    state.orders[index] = updated;
    showToast(`Status atualizado: ${updated.status}`, 'success');
    renderApp();
  }
};

window.startOrderLiveTracking = function(orderId) {
  if (window.activeTrackingTimers[orderId]) {
    clearInterval(window.activeTrackingTimers[orderId]);
    delete window.activeTrackingTimers[orderId];
    showToast(`Rastreamento dinâmico pausado para ${orderId}`, 'info');
    renderApp();
    return;
  }

  showToast(`Iniciando rastreamento dinâmico do pedido ${orderId}...`, 'info');
  window.activeTrackingTimers[orderId] = setInterval(() => {
    const index = state.orders.findIndex(o => o.id === orderId);
    if (index >= 0) {
      const currentOrder = state.orders[index];
      const step = Number(currentOrder.statusStep || 1);
      if (step >= 4) {
        clearInterval(window.activeTrackingTimers[orderId]);
        delete window.activeTrackingTimers[orderId];
        showToast(`Pedido ${orderId} foi entregue com sucesso na fazenda!`, 'success');
        renderApp();
        return;
      }
      const updated = orderTracker.advanceOrder(currentOrder);
      state.orders[index] = updated;
      showToast(`Pedido ${orderId}: ${updated.status}`, 'success');
      renderApp();
    }
  }, 3500);
  renderApp();
};

window.handleRegister = async function(event) {
  event.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const prop = document.getElementById('regProp').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

  try {
    const response = await registerUser({ name, propertyOrCompany: prop, email, password, role });
    const preparedUser = { ...response.user };
    delete preparedUser.password;
    state.user = preparedUser;
    authService.currentUser = preparedUser;
    persistUser();
    persistToken(response.token);

    // Redireciona para a tela pendente ou catálogo
    const targetScreen = state.pendingScreen || 'catalog';
    state.pendingScreen = null;
    state.activeScreen = targetScreen;

    showToast('Conta criada com sucesso!', 'success');
    renderApp();
  } catch (error) {
    showToast(error.message || 'Não foi possível criar sua conta.', 'error');
  }
};

window.handleLogin = async function(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await loginUser({ email, password });
    const loggedUser = { ...response.user };
    delete loggedUser.password;
    state.user = loggedUser;
    authService.currentUser = loggedUser;
    persistUser();
    persistToken(response.token);

    // Redireciona para a tela pendente ou catálogo
    const targetScreen = state.pendingScreen || 'catalog';
    state.pendingScreen = null;
    state.activeScreen = targetScreen;

    showToast('Login realizado com sucesso!', 'success');
    renderApp();
  } catch (error) {
    showToast(error.message || 'Não foi possível entrar.', 'error');
  }
};

window.handleLogout = function() {
  if (confirm('Deseja realmente sair da sua conta?')) {
    authService.logout();
    state.user = { name: '', propertyOrCompany: '', email: '', password: '', role: 'PRODUTOR' };
    state.activeScreen = 'catalog';
    state.authMode = 'register';
    state.pendingScreen = null;
    removeUser();
    removeToken();
    renderApp();
  }
};

function renderNavbar(cartCount = 0) {
  return `
    <nav style="background: #FFFFFF; border-bottom: 1px solid #E0EBE2; padding: 14px 18px; color: #163d27; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <img src="assets/logo.svg" alt="AgroTech" style="width: 52px; height: auto; cursor: pointer; flex-shrink: 0;" onclick="navigateTo('catalog')" />

      <div style="display: flex; align-items: center; gap: 10px;">
        <div onclick="navigateTo('profile')" style="cursor: pointer; width: 44px; height: 44px; border-radius: 12px; background: #EEF9F0; border: 1px solid #C8E6C9; display: flex; align-items: center; justify-content: center; color: #1B5E20;">
          ${icon('profile', 20)}
        </div>
        <div onclick="navigateTo('cart')" style="position: relative; cursor: pointer; width: 44px; height: 44px; border-radius: 12px; background: #EEF9F0; border: 1px solid #C8E6C9; display: flex; align-items: center; justify-content: center; color: #1B5E20;">
          ${icon('cart', 20)}
          ${cartCount > 0 ? `<span style="position: absolute; top: -6px; right: -4px; background: #D9A441; color: #1D2A1C; font-weight: 800; font-size: 10px; border-radius: 999px; padding: 3px 6px; min-width: 18px; text-align: center;">${cartCount}</span>` : ''}
        </div>
      </div>
    </nav>
  `;
}

function renderSellFab() {
  return `
    <button onclick="navigateTo('sell')" title="Anunciar produto" style="position: absolute; bottom: 88px; right: 16px; width: 58px; height: 58px; border-radius: 50%; background: #2E7D32; color: #FFFFFF; border: none; font-size: 30px; line-height: 1; font-weight: 700; cursor: pointer; z-index: 50; box-shadow: 0 4px 14px rgba(27,94,32,0.35); display: flex; align-items: center; justify-content: center; padding-bottom: 4px;">+</button>
  `;
}

function renderBottomNav() {
  // A aba "Minha Loja" só aparece quando o usuário tem itens à venda
  const myItems = state.user && state.user.email
    ? state.products.filter(p => p.ownerEmail === state.user.email)
    : [];
  const showStoreTab = myItems.length > 0;

  const tabStyle = (isActive) => `border-radius: 14px; background: ${isActive ? '#EAF7EE' : 'transparent'}; color: ${isActive ? '#163D27' : '#6C8574'}; border: ${isActive ? '1px solid rgba(46,125,50,0.12)' : '1px solid transparent'}; cursor:pointer; font-size:11px; font-family: inherit; font-weight: ${isActive ? '700' : '600'}; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s; min-width: 70px; padding: 8px 10px;`;

  return `
    <div style="background: rgba(255,255,255,0.96); border-top: 1px solid rgba(26,79,45,0.06); display: flex; justify-content: space-around; padding: 10px 12px 14px; flex-shrink: 0; z-index: 10;">
      <button onclick="navigateTo('catalog')" style="${tabStyle(state.activeScreen === 'catalog')}">
        <span style="display: inline-flex;">${icon('catalog', 19)}</span>Catálogo
      </button>
      ${showStoreTab ? `
      <button onclick="navigateTo('mystore')" style="${tabStyle(state.activeScreen === 'mystore')}">
        <span style="display: inline-flex;">${icon('store', 19)}</span>Minha Loja
      </button>
      ` : ''}
      <button onclick="navigateTo('finance')" style="${tabStyle(state.activeScreen === 'finance')}">
        <span style="display: inline-flex;">${icon('finance', 19)}</span>Financeiro
      </button>
      <button onclick="navigateTo('support')" style="${tabStyle(state.activeScreen === 'support')}">
        <span style="display: inline-flex;">${icon('support', 19)}</span>Suporte
      </button>
    </div>
  `;
}

function renderRegisterScreen() {
  const isLogin = state.authMode === 'login';
  const pendingScreenNames = {
    'cart': 'acessar o carrinho',
    'payment': 'finalizar a compra',
    'sell': 'anunciar um produto',
    'orders': 'ver seus pedidos',
    'finance': 'acessar o financeiro',
    'profile': 'acessar seu perfil'
  };
  const pendingReason = state.pendingScreen ? pendingScreenNames[state.pendingScreen] || 'acessar esta área' : null;

  return `
    <div style="flex: 1; padding: 32px 20px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; background: #F4FBF7;">
      <div style="text-align: center; margin-bottom: 8px;">
        <img src="assets/logo.svg" alt="AgroTech" style="width: 120px; height: auto;" />
      </div>
      <div style="text-align: left; margin-bottom: 4px;">
        <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 24px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.5px;">
          ${isLogin ? 'Bem-vindo de volta' : 'Crie sua conta AgroTech'}
        </h2>
        <p style="font-size: 13px; color: #388E3C; line-height: 1.4;">
          ${pendingReason
            ? `Faça login ou crie uma conta para ${pendingReason}.`
            : (isLogin ? 'Acesse o painel da sua propriedade com segurança.' : 'Sua plataforma completa para gestão e insumos do campo.')}
        </p>
      </div>

      <div style="display: flex; background: #DCEDC8; padding: 4px; border-radius: 12px; border: 1px solid #C8E6C9; box-shadow: none !important;">
        <button onclick="toggleAuthMode('register')" style="flex: 1; padding: 11px; border: none; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; background: ${!isLogin ? '#2E7D32' : 'transparent'}; color: ${!isLogin ? '#FFFFFF' : '#2E7D32'}; transition: all 0.2s; box-shadow: none !important; text-shadow: none !important; filter: none !important;">
          Criar Conta
        </button>
        <button onclick="toggleAuthMode('login')" style="flex: 1; padding: 11px; border: none; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; background: ${isLogin ? '#2E7D32' : 'transparent'}; color: ${isLogin ? '#FFFFFF' : '#2E7D32'}; transition: all 0.2s; box-shadow: none !important; text-shadow: none !important; filter: none !important;">
          Entrar
        </button>
      </div>

      ${state.pendingScreen ? `
        <button onclick="navigateTo('catalog')" style="background: transparent; color: #388E3C; border: 1px solid #C8E6C9; padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          ${icon('arrowLeft', 16)} Continuar sem login
        </button>
      ` : ''}

      ${!isLogin ? `
        <form onsubmit="handleRegister(event)" style="background: #FFFFFF; padding: 22px; border-radius: 20px; border: 1px solid rgba(200,230,201,0.8); display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="font-size: 12px; font-weight: 600; color: #1B5E20; display: block; margin-bottom: 6px; letter-spacing: 0.2px;">TIPO DE PERFIL</label>
            <select id="regRole" style="width: 100%; padding: 12px 14px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #F4FBF7; color: #1B5E20; box-sizing: border-box; outline: none;">
              <option value="PRODUTOR">Comprador Rural (Produtor)</option>
              <option value="VENDEDOR">Vendedor / Fornecedor Agro</option>
            </select>
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 600; color: #1B5E20; display: block; margin-bottom: 6px; letter-spacing: 0.2px;">NOME COMPLETO</label>
            <input type="text" id="regName" placeholder="Ex: João Silva" required style="width: 100%; padding: 12px 14px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 600; color: #1B5E20; display: block; margin-bottom: 6px; letter-spacing: 0.2px;">PROPRIEDADE OU EMPRESA</label>
            <input type="text" id="regProp" placeholder="Ex: Fazenda Boa Vista" required style="width: 100%; padding: 12px 14px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 600; color: #1B5E20; display: block; margin-bottom: 6px; letter-spacing: 0.2px;">E-MAIL</label>
            <input type="email" id="regEmail" placeholder="seuemail@fazenda.com" required style="width: 100%; padding: 12px 14px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 600; color: #1B5E20; display: block; margin-bottom: 6px; letter-spacing: 0.2px;">SENHA</label>
            <input type="password" id="regPassword" placeholder="••••••••" required style="width: 100%; padding: 12px 14px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>

          <button type="submit" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 15px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; margin-top: 6px; letter-spacing: 0.3px; box-shadow: none !important; text-shadow: none !important; filter: none !important;">Cadastrar Conta</button>
        </form>
      ` : `
        <form onsubmit="handleLogin(event)" style="background: #FFFFFF; padding: 22px; border-radius: 20px; border: 1px solid rgba(200,230,201,0.8); display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="font-size: 12px; font-weight: 600; color: #1B5E20; display: block; margin-bottom: 6px; letter-spacing: 0.2px;">E-MAIL</label>
            <input type="email" id="loginEmail" placeholder="seuemail@fazenda.com" required style="width: 100%; padding: 12px 14px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 600; color: #1B5E20; display: block; margin-bottom: 6px; letter-spacing: 0.2px;">SENHA</label>
            <input type="password" id="loginPassword" placeholder="••••••••" required style="width: 100%; padding: 12px 14px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>

          <button type="submit" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 15px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; margin-top: 6px; letter-spacing: 0.3px; box-shadow: none !important; text-shadow: none !important; filter: none !important;">Entrar no Sistema</button>
        </form>
      `}
    </div>
  `;
}

function renderCatalogScreen() {
  // Categorias derivadas apenas dos produtos já postados
  const existingCategories = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  const filtered = state.selectedCategory === 'Todos' || !existingCategories.includes(state.selectedCategory)
    ? state.products
    : state.products.filter(p => p.category === state.selectedCategory);
  const categories = existingCategories.length ? ['Todos', ...existingCategories] : [];

  return `
    <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">

      <!-- BANNER DE ANÚNCIO COM FOTOGRAFIA REAL DO AGRO (SEM DESENHOS, SEM SOMBRAMENTO) -->
      <div style="position: relative; border-radius: 20px; overflow: hidden; border: 1px solid #C8E6C9; background: #1B3D27; min-height: 180px; display: flex; flex-direction: column; justify-content: space-between; flex-shrink: 0;">
        <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80" alt="Lavoura de Grãos e Insumos Agrícolas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.45; z-index: 1;">

        <div style="position: relative; z-index: 2; padding: 18px 16px 14px; display: flex; flex-direction: column; gap: 12px; height: 100%; justify-content: space-between;">
          <div>
            <span style="background: #2E7D32; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 4px 9px; border-radius: 6px; letter-spacing: 0.6px; display: inline-block;">SAFRA 2026/2027 • MERCADO DIRETO DO CAMPO</span>
            <h4 style="font-family: 'Outfit', sans-serif;; margin: 8px 0 4px; font-size: 17px; font-weight: 700; color: #FFFFFF; line-height: 1.25;">Sementes Certificadas, Adubos & Maquinário</h4>
            <p style="font-size: 11px; opacity: 0.95; margin: 0; color: #F1F8E9; line-height: 1.4;">Frete Grátis Fazenda em compras acima de R$ 800 com seguro rural e laudo agronômico garantido.</p>
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <span style="background: rgba(0,0,0,0.45); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">Nota Fiscal Produtor</span>
            <span style="background: rgba(0,0,0,0.45); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">Logística Rural CIF</span>
            <span style="background: rgba(0,0,0,0.45); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">Registro MAPA</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.25); padding-top: 10px; margin-top: 2px;">
            <span style="font-size: 11px; font-weight: 700; color: #FBBF24;">Cupom: <strong>FRETEGRATIS</strong></span>
            <button onclick="navigateTo('sell')" style="background: #FBBF24; color: #163D27; border: none; padding: 7px 14px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer;">+ Anunciar Meu Lote</button>
          </div>
        </div>
      </div>

      <div style="position: relative; flex-shrink: 0;">
        <input type="text" id="searchInput" oninput="applySearchFilter()" placeholder="Buscar insumos, sementes, máquinas, lotes..." style="width: 100%; padding: 13px 16px 13px 42px; border-radius: 14px; border: 1px solid #C8E6C9; font-size: 13px; background: #FFFFFF; outline: none; box-sizing: border-box;">
        <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #6C8574; pointer-events: none; display: inline-flex;">${icon('search', 18)}</span>
      </div>

      ${categories.length > 0 ? `
      <div class="drag-scroll-container" data-drag-scroll="true" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; flex-shrink: 0; scrollbar-width: none;">
        ${categories.map(cat => `
          <button onclick="applyCategoryFilter('${cat}')" style="background: ${state.selectedCategory === cat ? '#2E7D32' : '#FFFFFF'}; color: ${state.selectedCategory === cat ? '#FFFFFF' : '#2E7D32'}; border: 1px solid ${state.selectedCategory === cat ? '#2E7D32' : '#C8E6C9'}; padding: 7px 16px; border-radius: 20px; font-size: 12px; font-weight: ${state.selectedCategory === cat ? '600' : '500'}; white-space: nowrap; cursor: pointer; transition: all 0.2s;">
            ${cat}
          </button>
        `).join('')}
      </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
        <h3 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 18px; font-weight: 700; margin: 0;">Catálogo de Insumos</h3>
        <span style="font-size: 11px; color: #388E3C; font-weight: 600;">${filtered.length} anúncios ativos</span>
      </div>

      <div id="productList" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        ${filtered.map(p => `
          <div class="product-card" data-title="${p.name}" data-category="${p.category}" style="background: #FFFFFF; border-radius: 16px; padding: 12px; border: 1px solid rgba(200,230,201,0.8); display: flex; flex-direction: column; justify-content: space-between; gap: 10px; transition: transform 0.2s;">
            <div onclick="openProductDetail('${p.id}')" style="cursor: pointer;">
              <div style="background: ${p.imageBg || '#E8F5E9'}; height: 100px; border-radius: 12px; display: flex; justify-content: center; align-items: center; border: 1px solid rgba(200,230,201,0.5); overflow: hidden; position: relative;">
                ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.outerHTML='<span style=&quot;font-size: 38px;&quot;>${p.imageEmoji || '📦'}</span>'" style="width: 100%; height: 100%; align-self: stretch; object-fit: cover;">` : `<span style="font-size: 38px;">${p.imageEmoji || '📦'}</span>`}
                ${p.location ? `
                  <span style="position: absolute; bottom: 4px; left: 4px; background: rgba(22,61,39,0.82); color: #FFFFFF; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 6px;">
                    <span style="display: inline-flex; vertical-align: middle; margin-right: 3px;">${icon('pin', 10)}</span>${p.location.split(' - ')[0]}
                  </span>
                ` : ''}
              </div>
              <h4 style="font-size: 13px; margin-top: 8px; color: #1B5E20; font-weight: 700; line-height: 1.3; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</h4>
              <p style="font-size: 11px; color: #388E3C; margin-top: 3px; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                <span style="display: inline-flex; color: #D9A441;">${icon('star', 12, 2)}</span>${p.rating}
                <span style="color: #81C784;">(${p.reviewsCount} avaliações)</span>
              </p>
            </div>
            <div>
              <div>
                <p style="color: #2E7D32; font-weight: 800; font-size: 14px; margin: 0 0 2px;">
                  R$ ${Number(p.price).toFixed(2)}
                  <span style="font-size: 10px; color: #6C8574; font-weight: 500; display: block;">/ ${p.unit || 'unidade'}</span>
                </p>
              </div>
              <button onclick="addToCart('${p.id}')" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 9px; border-radius: 9px; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.2s; margin-top: 6px;">+ Adicionar</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${state.selectedProduct ? `
      <div onclick="closeProductDetail()" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(27,94,32,0.45); backdrop-filter: blur(3px); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
        <div onclick="event.stopPropagation()" style="background: #FFFFFF; border-radius: 24px; width: 100%; max-width: 440px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #C8E6C9;">
          <div style="padding: 16px 20px; border-bottom: 1px solid #E8F5E9; display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #E8F5E9; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #1B5E20;">${state.selectedProduct.category}</span>
              <span style="background: #EAF7EE; color: #2E7D32; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 10px; border: 1px solid #A5D6A7; display: inline-flex; align-items: center; gap: 4px;">${icon('check', 11, 2.4)} Anúncio Verificado</span>
            </div>
            <button onclick="closeProductDetail()" style="background: #F4FBF7; border: 1px solid #C8E6C9; border-radius: 50%; width: 32px; height: 32px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #2E7D32; font-weight: bold;">✕</button>
          </div>

          <div style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; background: #F4FBF7;">
            <div style="text-align: center; background: ${state.selectedProduct.imageBg || '#E8F5E9'}; height: 180px; flex-shrink: 0; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #C8E6C9; overflow: hidden;">
              ${state.selectedProduct.image ? `<img src="${state.selectedProduct.image}" alt="${state.selectedProduct.name}" onerror="this.outerHTML='<span style=&quot;font-size: 68px;&quot;>${state.selectedProduct.imageEmoji || '📦'}</span>'" style="width: 100%; height: 100%; align-self: stretch; object-fit: cover;">` : `<span style="font-size: 68px;">${state.selectedProduct.imageEmoji || '📦'}</span>`}
            </div>

            <div>
              <span style="font-size: 11px; color: #388E3C; font-weight: 700;">PRODUTOR: ${state.selectedProduct.sellerName || 'Fazenda Parceira AgroTech'}</span>
              <h3 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 20px; font-weight: 700; line-height: 1.3; margin: 4px 0 0;">${state.selectedProduct.name}</h3>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px;">
                <p style="font-size: 22px; font-weight: 800; color: #2E7D32; margin: 0;">
                  R$ ${Number(state.selectedProduct.price).toFixed(2)}
                  <span style="font-size: 12px; color: #5D6F62; font-weight: 500;">/ ${state.selectedProduct.unit || 'unidade'}</span>
                </p>
                <span style="background: #E8F5E9; border: 1px solid #A5D6A7; color: #1B5E20; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                  <span style="display: inline-flex; color: #D9A441;">${icon('star', 13, 2)}</span>${state.selectedProduct.rating} (${state.selectedProduct.reviewsCount})
                </span>
              </div>
            </div>

            <!-- FICHA TÉCNICA DO ANÚNCIO AGRO -->
            <div style="background: #FFFFFF; padding: 14px; border-radius: 14px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
              <h4 style="font-size: 11px; font-weight: 800; color: #1B5E20; letter-spacing: 0.5px; text-transform: uppercase; margin: 0 0 2px; display: flex; align-items: center; gap: 6px;">${icon('clipboard', 14)} Ficha Técnica & Procedência do Lote</h4>

              <div style="display: flex; justify-content: space-between; color: #1B5E20;">
                <span style="color: #6C8574; display: inline-flex; align-items: center; gap: 6px;">${icon('pin', 14)} Origem da Carga:</span>
                <span style="font-weight: 700;">${state.selectedProduct.location || 'Rio Verde - GO'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #1B5E20;">
                <span style="color: #6C8574; display: inline-flex; align-items: center; gap: 6px;">${icon('box', 14)} Estoque do Lote:</span>
                <span style="font-weight: 700; color: #2E7D32;">${state.selectedProduct.stock || 120} ${state.selectedProduct.unit || 'unidades'} disponíveis</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #1B5E20;">
                <span style="color: #6C8574; display: inline-flex; align-items: center; gap: 6px;">${icon('truck', 14)} Modalidade Frete:</span>
                <span style="font-weight: 700;">${state.selectedProduct.shippingType || 'CIF - Entrega Direta na Fazenda'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #1B5E20;">
                <span style="color: #6C8574; display: inline-flex; align-items: center; gap: 6px;">${icon('doc', 14)} Laudo / Certificação:</span>
                <span style="font-weight: 700; text-align: right; max-width: 60%;">${state.selectedProduct.certification || 'Registro MAPA • Emite Nota Fiscal Eletrônica (NF-e)'}</span>
              </div>
            </div>

            <div style="background: #FFFFFF; padding: 14px; border-radius: 14px; border: 1px solid #C8E6C9;">
              <h4 style="font-size: 12px; font-weight: 700; color: #1B5E20; margin-bottom: 6px; letter-spacing: 0.3px; display: flex; align-items: center; gap: 6px;">${icon('doc', 14)} DESCRIÇÃO TÉCNICA DO ANÚNCIO</h4>
              <p style="font-size: 12px; color: #388E3C; line-height: 1.5; margin: 0;">${state.selectedProduct.description || 'Anúncio sem descrição detalhada cadastrada pelo produtor.'}</p>
            </div>

            <!-- FAVORITO + CONTATO DIRETO COM O ANUNCIANTE -->
            <div style="display: flex; gap: 8px;">
              <button onclick="toggleFavorite('${state.selectedProduct.id}')" style="flex: 0 0 48px; background: ${(state.user.favorites || []).includes(state.selectedProduct.id) ? '#FBBF24' : '#FFFFFF'}; border: 1px solid ${(state.user.favorites || []).includes(state.selectedProduct.id) ? '#D9A441' : '#A5D6A7'}; color: ${(state.user.favorites || []).includes(state.selectedProduct.id) ? '#7A5A00' : '#1B5E20'}; padding: 12px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer;">★</button>
              <button onclick="showToast('Conectando ao WhatsApp do Produtor: (64) 99812-4420...', 'info')" style="flex: 1; background: #E8F5E9; border: 1px solid #A5D6A7; color: #1B5E20; padding: 12px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="display: inline-flex;">${icon('support', 16)}</span> Falar com o Produtor
              </button>
            </div>

            ${state.selectedProduct.ownerEmail === state.user.email ? `
              <button onclick="deleteProduct('${state.selectedProduct.id}')" style="background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">${icon('trash', 15)} Excluir Meu Anúncio</button>
            ` : ''}

            <div style="background: #FFFFFF; padding: 16px; border-radius: 14px; border: 1px solid #C8E6C9;">
              <h4 style="font-size: 12px; font-weight: 700; color: #1B5E20; margin-bottom: 8px; letter-spacing: 0.3px; display: flex; align-items: center; gap: 6px;">${icon('star', 14)} AVALIAR PRODUTO</h4>

              <form onsubmit="submitReview(event)" style="display: flex; flex-direction: column; gap: 10px;">
                <div>
                  <label style="font-size: 11px; color: #388E3C; font-weight: 600; display: block; margin-bottom: 4px;">Sua Nota:</label>
                  <div style="display: flex; gap: 6px;">
                    ${[1,2,3,4,5].map(star => `
                      <button type="button" onclick="setNewRatingStar(${star})" style="background: none; border: none; font-size: 22px; cursor: pointer; padding: 0;">
                        ${star <= state.newRatingStar
                          ? `<span style="display: inline-flex; color: #D9A441;">${icon('star', 22, 1.4)}</span>`
                          : `<span style="display: inline-flex; color: #A5D6A7;">${icon('star', 22, 1.4)}</span>`}
                      </button>
                    `).join('')}
                  </div>
                </div>

                <div>
                  <textarea id="reviewText" placeholder="Conte sua experiência com este lote ou produtor..." required style="width: 100%; min-height: 70px; padding: 10px; border: 1px solid #A5D6A7; border-radius: 9px; font-size: 12px; box-sizing: border-box; resize: vertical; background: #FFFFFF; outline: none;"></textarea>
                </div>

                <button type="submit" style="background: #2E7D32; color: white; border: none; padding: 10px; border-radius: 9px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: none !important;">Publicar Avaliação</button>
              </form>
            </div>

            <div>
              <h4 style="font-size: 13px; font-weight: 700; color: #1B5E20; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">${icon('support', 15)} Avaliações de Produtores (${(state.selectedProduct.comments || []).length})</h4>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${(state.selectedProduct.comments || []).map(c => `
                  <div style="background: #FFFFFF; padding: 12px; border-radius: 12px; font-size: 12px; border: 1px solid #C8E6C9;">
                    <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px; color: #1B5E20;">
                      <span>${c.author}</span>
                      <span style="color: #388E3C;">${c.rating} estrelas</span>
                    </div>
                    <p style="color: #388E3C; line-height: 1.4; margin: 0;">"${c.text}"</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div style="padding: 14px 20px; border-top: 1px solid #C8E6C9; background: #FFFFFF; flex-shrink: 0;">
            <button onclick="addToCart('${state.selectedProduct.id}'); closeProductDetail();" style="width: 100%; background: #2E7D32; color: white; border: none; padding: 14px; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 14px;">+ Adicionar ao Carrinho (R$ ${Number(state.selectedProduct.price).toFixed(2)})</button>
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

// --- TELA DE ANÚNCIO / VENDER PRODUTO ---
function renderSellScreen() {
  return `
    <div style="flex: 1; padding: 22px 18px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">

      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="navigateTo('catalog')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 10px; width: 36px; height: 36px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #2E7D32;">←</button>
          <div>
            <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 22px; font-weight: 700; margin: 0;">Anunciar Lote ou Insumo</h2>
            <p style="font-size: 11px; color: #388E3C; margin: 2px 0 0;">Mercado direto entre produtores rurais</p>
          </div>
        </div>
      </div>

      <!-- IA ASSISTENTE DE ANÚNCIO -->
      <div style="background: #E8F5E9; padding: 12px 14px; border-radius: 14px; border: 1px solid #C8E6C9;">
        <span style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 6px;">IA ASSISTENTE: DESCREVA O PRODUTO COM TODAS AS INFORMAÇÕES</span>
        <textarea id="aiPrompt" placeholder="Ex: Tenho 5000 kg de milho híbrido cultivar BRS 1010, R$ 120 o kg, colhido out/2025, germinação 95%, silo seco, retirada imediata na fazenda Rio Verde-GO. Crie descrição técnica completa." style="width: 100%; min-height: 80px; padding: 10px 12px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 12px; background: #FFFFFF; box-sizing: border-box; resize: vertical; outline: none; font-family: inherit;"></textarea>
        <p style="font-size: 10px; color: #388E3C; margin: 6px 0 8px;">Dica: cite cultivar/variedade (grãos), formulação NPK (fertilizantes), ingrediente ativo (defensivos), marca/modelo (máquinas). Adicione "crie descrição" para ficha técnica detalhada automática.</p>
        <button type="button" onclick="aiFillProduct()" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 12px;">Preencher Formulário com IA</button>
      </div>

      <form onsubmit="handlePublishProduct(event)" style="background: #FFFFFF; padding: 20px; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; gap: 14px;">

        <div>
          <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px; letter-spacing: 0.3px;">TÍTULO COMERCIAL DO ANÚNCIO / LOTE</label>
          <input type="text" id="prodName" placeholder="Ex: Semente de Soja Certificada Safra 26/27 ou Adubo NPK" required style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
        </div>

        <div style="display: flex; gap: 10px;">
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">PREÇO (R$)</label>
            <input type="number" step="0.01" id="prodPrice" placeholder="0.00" required style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">UNIDADE DE VENDA</label>
            <select id="prodUnit" style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; color: #1B5E20; box-sizing: border-box; outline: none;">
              <option value="kg">Kg</option>
              <option value="tonelada">Tonelada</option>
              <option value="unidade">Unidade</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">CATEGORIA</label>
            <select id="prodCategory" style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; color: #1B5E20; box-sizing: border-box; outline: none;">
              <option value="Rações">Rações e Nutrição</option>
              <option value="Fertilizantes">Fertilizantes e Adubos</option>
              <option value="Grãos">Sementes e Grãos</option>
              <option value="Máquinas">Máquinas e Implementos</option>
              <option value="Outros">Outros Insumos</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">ESTOQUE DO LOTE</label>
            <input type="number" id="prodStock" placeholder="Ex: 150" value="100" required style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">CIDADE / UF DA FAZENDA</label>
            <input type="text" id="prodLocation" placeholder="Ex: Rio Verde - GO" required style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          </div>
          <div style="flex: 1;">
            <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">MODALIDADE LOGÍSTICA</label>
            <select id="prodShippingType" style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; color: #1B5E20; box-sizing: border-box; outline: none;">
              <option value="CIF - Entrega na Fazenda (AgroExpress)">CIF - Entrega na Porteira (AgroExpress)</option>
              <option value="FOB - Retirada na Porteira">FOB - Retirada na Propriedade</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">FOTOGRAFIA DO LOTE (UPLOAD DE IMAGEM)</label>
          <input type="hidden" id="prodImage" value="">
          <img id="prodImagePreview" alt="" style="display: none; width: 100%; max-height: 160px; object-fit: cover; border-radius: 10px; border: 1px solid #A5D6A7; margin-bottom: 8px;">
          <input type="file" accept="image/*" onchange="handleProductImageUpload(event)" style="width: 100%; padding: 10px 12px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 12px; background: #FFFFFF; box-sizing: border-box; outline: none;">
          <p style="font-size: 10px; color: #388E3C; margin: 5px 0 0;">JPG ou PNG, até 2MB.</p>
        </div>

        <div>
          <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px;">FICHA TÉCNICA E DESCRIÇÃO DO LOTE</label>
          <textarea id="prodDesc" placeholder="Descreva germinação, laudo de análise, época de plantio/dosagem, embalagem e prazos de retirada..." required style="width: 100%; min-height: 90px; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; resize: vertical; outline: none;"></textarea>
        </div>

        <button type="submit" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 15px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; margin-top: 4px; box-shadow: none !important; text-shadow: none !important;">Publicar Anúncio no Mercado AgroTech</button>
      </form>

    </div>
  `;
}

function renderCartScreen() {
  const totals = getCartTotals();
  const couponsList = [
    { code: 'AGRO10', label: '10% OFF', desc: 'Compras acima de R$ 150', min: 150 },
    { code: 'FRETEGRATIS', label: 'Frete Grátis', desc: 'Compras acima de R$ 400', min: 400 },
    { code: 'NOVOCLIENTE', label: 'R$ 25 OFF', desc: 'Compras acima de R$ 100', min: 100 },
    { code: 'COLHEITA20', label: '20% OFF', desc: 'Compras acima de R$ 800', min: 800 }
  ];

  return `
    <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-weight: 700; margin: 0;">Carrinho de Compras</h2>
        <span style="font-size: 12px; color: #388E3C; font-weight: 600;">${state.cart.reduce((s, i) => s + i.quantity, 0)} item(ns)</span>
      </div>

      ${state.cart.length === 0 ? `
        <div style="background: #FFFFFF; padding: 30px; text-align: center; border-radius: 20px; border: 1px solid #C8E6C9;">
          <p style="color: #388E3C; font-size: 14px; margin-bottom: 16px;">Seu carrinho está vazio.</p>
          <button onclick="navigateTo('catalog')" style="background: #2E7D32; color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer;">Voltar ao Catálogo</button>
        </div>
      ` : `
        <div style="background: #FFFFFF; border-radius: 20px; padding: 16px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; gap: 12px;">
          ${state.cart.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E8F5E9; padding-bottom: 12px;">
              <div style="flex: 1; padding-right: 8px;">
                <p style="font-size: 13px; font-weight: 700; color: #1B5E20; margin: 0;">${item.name}</p>
                <p style="font-size: 12px; color: #388E3C; margin-top: 2px;">R$ ${Number(item.price).toFixed(2)} un.</p>

                <div style="display: inline-flex; align-items: center; gap: 8px; margin-top: 6px; background: #F4FBF7; border: 1px solid #C8E6C9; border-radius: 8px; padding: 2px 6px;">
                  <button type="button" onclick="changeCartQuantity('${item.id}', -1)" style="background: transparent; color: #1B5E20; font-weight: 800; font-size: 14px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">−</button>
                  <span style="font-size: 12px; font-weight: 700; color: #1B5E20; min-width: 16px; text-align: center;">${item.quantity}</span>
                  <button type="button" onclick="changeCartQuantity('${item.id}', 1)" style="background: transparent; color: #1B5E20; font-weight: 800; font-size: 14px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">+</button>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <p style="font-weight: 700; font-size: 14px; color: #2E7D32; margin: 0;">R$ ${(Number(item.price) * Number(item.quantity)).toFixed(2)}</p>
                <button onclick="removeFromCart('${item.id}')" title="Remover item" style="background: #FFEBEE; color: #C62828; border: none; padding: 6px 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">✕</button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background: #FFFFFF; padding: 16px; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <label style="font-size: 12px; font-weight: 700; color: #1B5E20; letter-spacing: 0.2px;">CUPONS DISPONÍVEIS</label>
            <span style="font-size: 10px; color: #388E3C;">Toque para aplicar</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${couponsList.map(c => {
              const isEligible = totals.subtotal >= c.min;
              const isApplied = state.appliedCoupon === c.code;

              return `
                <div onclick="copyCoupon('${c.code}')" style="background: ${isApplied ? '#C8E6C9' : isEligible ? '#E8F5E9' : '#F5F5F5'}; border: 1px ${isApplied ? 'solid #2E7D32' : 'dashed ' + (isEligible ? '#2E7D32' : '#BDBDBD')}; padding: 8px; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span style="font-size: 11px; font-weight: 800; color: ${isApplied ? '#1B5E20' : isEligible ? '#1B5E20' : '#757575'};">${c.code}</span>
                    ${isApplied ? `<span style="display: inline-flex; color: #2E7D32; vertical-align: middle;">${icon('check', 11, 2.4)}</span>` : ''}
                  </div>
                  <span style="font-size: 10px; font-weight: 700; color: #2E7D32; display: block; margin-top: 2px;">${c.label}</span>
                  <span style="font-size: 9px; color: #616161; display: block;">mín. R$ ${c.min}</span>
                </div>
              `;
            }).join('')}
          </div>

          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <input type="text" id="couponInput" value="${state.appliedCoupon || ''}" placeholder="Digite o código (ex: AGRO10)" style="flex: 1; padding: 10px 12px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; outline: none; text-transform: uppercase;">
            <button onclick="applyCoupon()" style="background: #2E7D32; color: white; border: none; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;">Aplicar</button>
            ${state.appliedCoupon ? `
              <button onclick="removeAppliedCoupon()" title="Remover cupom" style="background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;">Remover</button>
            ` : ''}
          </div>

          ${state.appliedCoupon ? `
            <div style="background: #E8F5E9; border: 1px solid #A5D6A7; border-radius: 8px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #1B5E20; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">${icon('check', 12, 2.4)} Cupom <strong>${state.appliedCoupon}</strong> ativo</span>
              <span style="font-size: 11px; color: #2E7D32; font-weight: 600;">Desconto de R$ ${totals.discount.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>

        <div style="background: #FFFFFF; padding: 16px; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #388E3C;">
            <span>Subtotal</span><span>R$ ${totals.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #2E7D32; font-weight: 600;">
            <span>Desconto</span><span>- R$ ${totals.discount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #388E3C;">
            <span>Frete Fazenda</span><span>${totals.shipping === 0 ? '<strong style="color: #2E7D32;">GRÁTIS</strong>' : `R$ ${totals.shipping.toFixed(2)}`}</span>
          </div>
          ${totals.subtotal < 800 ? `
            <span style="font-size: 10px; color: #689F38;">Dica: Frete grátis automático em compras a partir de R$ 800,00!</span>
          ` : `
            <span style="font-size: 10px; color: #2E7D32; font-weight: 700;">🎉 Você ganhou frete grátis por compra acima de R$ 800!</span>
          `}
          <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 16px; border-top: 1px solid #E8F5E9; padding-top: 10px; color: #1B5E20; margin-top: 4px;">
            <span>Total</span><span>R$ ${totals.total.toFixed(2)}</span>
          </div>
        </div>

        <button onclick="navigateTo('payment')" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 16px; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 15px;">Ir para o Pagamento ➔</button>
      `}
    </div>
  `;
}

function renderPaymentScreen() {
  const totals = getCartTotals();
  const installments = [1, 2, 3, 4, 5, 6];
  const selectedInstallment = Number(state.creditInstallments || 1);
  const installmentValue = totals.total / selectedInstallment;

  return `
    <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; background: #F4FBF7;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button onclick="navigateTo('cart')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 10px; width: 36px; height: 36px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #2E7D32;">←</button>
        <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-weight: 700; margin: 0;">Forma de Pagamento</h2>
      </div>

      <div style="background: #FFFFFF; padding: 16px; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 14px; color: #388E3C;">Total a Pagar:</span>
        <span style="font-size: 20px; font-weight: 800; color: #2E7D32;">R$ ${totals.total.toFixed(2)}</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button onclick="setPaymentMethod('pix')" style="padding: 14px 16px; border-radius: 14px; border: 2px solid ${state.paymentMethod === 'pix' ? '#2E7D32' : '#C8E6C9'}; background: ${state.paymentMethod === 'pix' ? '#E8F5E9' : '#FFFFFF'}; color: #1B5E20; font-weight: 700; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
          <div style="text-align: left;">
            <span>⚡ Pix (Aprovação Imediata)</span>
            <span style="display: block; font-size: 11px; color: #388E3C; font-weight: 500; margin-top: 2px;">Liberação instantânea do pedido</span>
          </div>
          <span>${state.paymentMethod === 'pix' ? '🟢' : '⚪'}</span>
        </button>

        <button onclick="setPaymentMethod('credit')" style="padding: 14px 16px; border-radius: 14px; border: 2px solid ${state.paymentMethod === 'credit' ? '#2E7D32' : '#C8E6C9'}; background: ${state.paymentMethod === 'credit' ? '#E8F5E9' : '#FFFFFF'}; color: #1B5E20; font-weight: 700; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
          <div style="text-align: left;">
            <span>💳 Cartão de Crédito (até 6x sem juros)</span>
            <span style="display: block; font-size: 11px; color: #388E3C; font-weight: 500; margin-top: 2px;">Parcelamento rural facilitado</span>
          </div>
          <span>${state.paymentMethod === 'credit' ? '🟢' : '⚪'}</span>
        </button>

        <button onclick="setPaymentMethod('boleto')" style="padding: 14px 16px; border-radius: 14px; border: 2px solid ${state.paymentMethod === 'boleto' ? '#2E7D32' : '#C8E6C9'}; background: ${state.paymentMethod === 'boleto' ? '#E8F5E9' : '#FFFFFF'}; color: #1B5E20; font-weight: 700; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
          <div style="text-align: left;">
            <span style="display: inline-flex; align-items: center; gap: 6px;">${icon('doc', 15)} Boleto Bancário</span>
            <span style="display: block; font-size: 11px; color: #388E3C; font-weight: 500; margin-top: 2px;">Vencimento em 3 dias úteis</span>
          </div>
          <span>${state.paymentMethod === 'boleto' ? '🟢' : '⚪'}</span>
        </button>
      </div>

      <form onsubmit="processPayment(event)" style="background: #FFFFFF; padding: 20px; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; gap: 14px;">
        ${state.paymentMethod === 'pix' ? `
          <div style="text-align: center; padding: 6px 0;">
            <p style="font-size: 13px; color: #388E3C; margin-bottom: 12px;">Escaneie o QR Code ou copie a chave Pix gerada após a confirmação:</p>
            <div style="width: 140px; height: 140px; background: #E8F5E9; border: 2px dashed #2E7D32; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 16px;">
              <span style="font-size: 40px;">📱</span>
              <span style="font-size: 10px; font-weight: 700; color: #1B5E20;">PIX AGROTECH</span>
            </div>
            <p style="font-size: 11px; color: #66BB6A; margin-top: 10px;">Chave CNPJ: 12.345.678/0001-90</p>
          </div>
        ` : ''}

        ${state.paymentMethod === 'credit' ? `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 4px;">NÚMERO DE PARCELAS</label>
              <select onchange="setCreditInstallments(this.value)" style="width: 100%; padding: 11px 12px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; color: #1B5E20; outline: none;">
                ${installments.map(n => `
                  <option value="${n}" ${selectedInstallment === n ? 'selected' : ''}>
                    ${n}x de R$ ${(totals.total / n).toFixed(2)} sem juros
                  </option>
                `).join('')}
              </select>
            </div>

            <div>
              <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 4px;">NÚMERO DO CARTÃO</label>
              <input type="text" placeholder="0000 0000 0000 0000" required style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
            </div>

            <div>
              <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 4px;">NOME IMPRESSO NO CARTÃO</label>
              <input type="text" placeholder="Nome como no cartão" required style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
            </div>

            <div style="display: flex; gap: 10px;">
              <div style="flex: 1;">
                <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 4px;">VALIDADE</label>
                <input type="text" placeholder="MM/AA" required style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
              </div>
              <div style="flex: 1;">
                <label style="font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 4px;">CVV</label>
                <input type="text" placeholder="123" required maxlength="4" style="width: 100%; padding: 12px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box; outline: none;">
              </div>
            </div>
          </div>
        ` : ''}

        ${state.paymentMethod === 'boleto' ? `
          <div style="text-align: center; padding: 8px 0; display: flex; flex-direction: column; gap: 10px;">
            <p style="font-size: 13px; color: #388E3C; margin: 0;">Boleto com compensação bancária em até 48 horas úteis.</p>
            <div style="background: #FAFAFA; border: 1px solid #E0E0E0; border-radius: 12px; padding: 14px; font-family: monospace; font-size: 13px; color: #212121; word-break: break-all;">
              34191.79001 01043.510047 91020.150008 4 982100000${Math.floor(totals.total)}
            </div>
            <p style="font-size: 11px; color: #757575; margin: 0;">O código de barras poderá ser pago pelo aplicativo do seu banco ou casa lotérica.</p>
          </div>
        ` : ''}

        <button type="submit" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 16px; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 15px; margin-top: 6px; box-shadow: none !important;">
          ${state.paymentMethod === 'credit'
            ? `Pagar em ${selectedInstallment}x de R$ ${installmentValue.toFixed(2)}`
            : state.paymentMethod === 'boleto'
            ? 'Gerar Boleto e Concluir Pedido'
            : 'Confirmar Pagamento Pix'}
        </button>
      </form>
    </div>
  `;
}

function renderFinanceScreen() {
  const balance = state.finance.income - state.finance.expenses;
  const currentFilter = state.financeFilter || 'ALL';

  const filteredTransactions = state.finance.transactions.filter(item => {
    if (currentFilter === 'INCOME') return item.type === 'INCOME';
    if (currentFilter === 'EXPENSE') return item.type === 'EXPENSE';
    return true;
  });

  const totalAppOrdersCost = state.orders.reduce((sum, ord) => sum + Number(ord.total || 0), 0);

  return `
    <div style="flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; background: #F4FBF7;">
      <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-weight: 700; margin: 0;">Gestão Financeira</h2>

      <div style="background: #1B5E20; color: white; padding: 20px; border-radius: 20px; text-align: center;">
        <span style="font-size: 12px; opacity: 0.9; font-weight: 500;">Saldo Atual da Fazenda</span>
        <h3 style="font-size: 26px; font-weight: 700; margin-top: 4px; letter-spacing: -0.5px;">R$ ${balance.toFixed(2)}</h3>
      </div>

      <div style="display: flex; gap: 12px;">
        <div style="flex: 1; background: #EAF7EE; padding: 16px 14px; border-radius: 18px; border: 1px solid rgba(46,125,50,0.18); display: flex; flex-direction: column; gap: 8px;">
          <p style="font-size: 10px; color: #2E7D32; font-weight: 800; letter-spacing: 0.9px; text-transform: uppercase; margin: 0;">Vendas (Entradas)</p>
          <p style="font-weight: 800; color: #163D27; font-size: 16px; margin: 0;">+ R$ ${state.finance.income.toFixed(2)}</p>
        </div>
        <div style="flex: 1; background: #FFF1F3; padding: 16px 14px; border-radius: 18px; border: 1px solid rgba(201,52,65,0.14); display: flex; flex-direction: column; gap: 8px;">
          <p style="font-size: 10px; color: #C62828; font-weight: 800; letter-spacing: 0.9px; text-transform: uppercase; margin: 0;">Compras (Saídas)</p>
          <p style="font-weight: 800; color: #6B1E2B; font-size: 16px; margin: 0;">- R$ ${state.finance.expenses.toFixed(2)}</p>
        </div>
      </div>

      <div style="background: #FFFFFF; border-radius: 18px; border: 1px solid #C8E6C9; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #1B5E20; text-transform: uppercase; letter-spacing: 0.5px;">Compras na AgroTech</span>
          <p style="font-size: 16px; font-weight: 800; color: #2E7D32; margin: 4px 0 0;">${state.orders.length} pedido(s) • R$ ${totalAppOrdersCost.toFixed(2)}</p>
        </div>
        <button onclick="navigateTo('orders')" style="background: #E8F5E9; border: 1px solid #A5D6A7; color: #1B5E20; padding: 8px 12px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer;">
          Ver Pedidos ➔
        </button>
      </div>

      ${renderFinanceChart(state.finance.chartData)}

      <div style="background: #FFFFFF; padding: 18px; border-radius: 20px; border: 1px solid #C8E6C9;">
        <h4 style="font-size: 13px; color: #1B5E20; font-weight: 700; margin-bottom: 12px;">Registrar Nova Operação Manual</h4>
        <form onsubmit="handleAddTransaction(event)" style="display: flex; flex-direction: column; gap: 10px;">
          <input type="text" id="txTitle" placeholder="Ex: Venda de Sacas de Soja, Compra de Diesel" required style="width: 100%; padding: 11px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 12px; background: #FFFFFF; box-sizing: border-box; outline: none;">

          <div style="display: flex; gap: 8px; align-items: stretch; width: 100%; box-sizing: border-box;">
            <input type="number" step="0.01" id="txAmount" placeholder="Valor (R$)" required style="flex: 1; min-width: 0; padding: 11px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 12px; background: #FFFFFF; box-sizing: border-box; outline: none;">
            <select id="txType" style="flex: 1; min-width: 0; padding: 11px 14px; border: 1px solid #A5D6A7; border-radius: 10px; font-size: 12px; background: #FFFFFF; color: #1B5E20; box-sizing: border-box; outline: none;">
              <option value="INCOME">Venda (Entrada)</option>
              <option value="EXPENSE">Compra (Saída)</option>
            </select>
          </div>

          <button type="submit" style="background: #2E7D32; color: white; border: none; padding: 11px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 4px; box-shadow: none !important;">Lançar Operação</button>
        </form>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="font-size: 15px; color: #1B5E20; font-weight: 700; margin: 0;">Extrato do Mês</h4>
          <span style="font-size: 11px; color: #388E3C;">${filteredTransactions.length} lançamentos</span>
        </div>

        <div class="drag-scroll-container" data-drag-scroll="true" style="display: flex; gap: 6px; margin-bottom: 10px; overflow-x: auto; scrollbar-width: none;">
          <button onclick="setFinanceFilter('ALL')" style="background: ${currentFilter === 'ALL' ? '#2E7D32' : '#FFFFFF'}; color: ${currentFilter === 'ALL' ? '#FFFFFF' : '#1B5E20'}; border: 1px solid ${currentFilter === 'ALL' ? '#2E7D32' : '#C8E6C9'}; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer;">
            Todas
          </button>
          <button onclick="setFinanceFilter('INCOME')" style="background: ${currentFilter === 'INCOME' ? '#2E7D32' : '#FFFFFF'}; color: ${currentFilter === 'INCOME' ? '#FFFFFF' : '#1B5E20'}; border: 1px solid ${currentFilter === 'INCOME' ? '#2E7D32' : '#C8E6C9'}; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer;">
            Vendas (+ Entradas)
          </button>
          <button onclick="setFinanceFilter('EXPENSE')" style="background: ${currentFilter === 'EXPENSE' ? '#2E7D32' : '#FFFFFF'}; color: ${currentFilter === 'EXPENSE' ? '#FFFFFF' : '#1B5E20'}; border: 1px solid ${currentFilter === 'EXPENSE' ? '#2E7D32' : '#C8E6C9'}; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer;">
            Compras (- Saídas)
          </button>
        </div>

        <div style="background: #FFFFFF; border-radius: 20px; border: 1px solid #C8E6C9; padding: 14px 18px; display: flex; flex-direction: column; gap: 12px;">
          ${filteredTransactions.length === 0 ? `
            <p style="text-align: center; color: #9E9E9E; font-size: 12px; margin: 10px 0;">Nenhum lançamento encontrado nesta categoria.</p>
          ` : filteredTransactions.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E8F5E9; padding-bottom: 10px; font-size: 13px;">
              <div>
                <p style="font-weight: 600; color: #1B5E20; margin: 0;">${item.title}</p>
                <span style="font-size: 10px; color: #388E3C;">${item.date}</span>
              </div>
              <span style="color: ${item.type === 'INCOME' ? '#2E7D32' : '#C62828'}; font-weight: 700;">
                ${item.type === 'INCOME' ? '+' : '-'} R$ ${Number(item.amount).toFixed(2)}
              </span>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;
}

// --- TELA DA MINHA LOJA (anúncios do produtor logado) ---
function renderMyStoreScreen() {
  const isLoggedIn = state.user && state.user.email && state.user.email.trim() !== '';
  const myProducts = state.products.filter(p => p.ownerEmail === state.user.email);
  const storeName = state.user.propertyOrCompany || state.user.name || 'Minha Loja';
  const totalValue = myProducts.reduce((sum, p) => sum + (Number(p.price) * Number(p.stock || 1)), 0);
  const totalStock = myProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);

  return `
    <div style="flex: 1; padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button onclick="navigateTo('profile')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 10px; width: 36px; height: 36px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #2E7D32;">←</button>
        <div>
          <h2 style="font-family: 'Outfit', sans-serif; color: #1B5E20; font-size: 22px; font-weight: 700; margin: 0;">Minha Loja</h2>
          <p style="font-size: 11px; color: #388E3C; margin: 2px 0 0;">Anúncios publicados por você</p>
        </div>
      </div>

      ${!isLoggedIn ? `
        <div style="background: #FFFFFF; padding: 36px 20px; text-align: center; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <p style="color: #1B5E20; font-size: 15px; font-weight: 700; margin: 0;">Entre para ver sua loja</p>
          <p style="color: #388E3C; font-size: 12px; margin: 0;">Você precisa estar logado como produtor ou vendedor.</p>
          <button onclick="navigateTo('cart')" style="background: #2E7D32; color: #FFFFFF; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; margin-top: 8px;">Fazer Login</button>
        </div>
      ` : `
      <div style="background: #1B5E20; color: #FFFFFF; border-radius: 20px;">
        <div style="height: 96px; border-radius: 20px 20px 0 0; background: linear-gradient(135deg, #1B5E20, #2E7D32); overflow: hidden;">
          ${state.user.storeCoverImage ? `<img src="${state.user.storeCoverImage}" alt="Capa da loja" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
        </div>
        <div style="padding: 14px 18px 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: -48px;">
            <div style="width: 72px; height: 72px; border-radius: 16px; background: rgba(255,255,255,0.2); border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 32px; flex-shrink: 0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
              ${state.user.storeProfileImage ? `<img src="${state.user.storeProfileImage}" alt="Perfil" style="width: 100%; height: 100%; object-fit: cover;">` : '🏪'}
            </div>
            <div style="margin-top: 52px;">
              <button onclick="openStoreEditor()" style="background: #FFFFFF; color: #1B5E20; border: none; padding: 8px 14px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; white-space: nowrap;">✏️ Editar</button>
            </div>
          </div>
          <div style="margin-top: 10px;">
            <h3 style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; margin: 0; line-height: 1.3; word-break: break-word;">${storeName}</h3>
            <p style="font-size: 11px; opacity: 0.85; margin-top: 3px;">${myProducts.length} anúncio(s) ativo(s)</p>
          </div>
        </div>
        ${state.user.storeBio || state.user.storePhone || state.user.storeLocation || state.user.storeHours ? `
        <div style="padding: 0 18px 16px; font-size: 12px; opacity: 0.95; display: flex; flex-direction: column; gap: 4px;">
          ${state.user.storeLocation ? `<span>📍 ${state.user.storeLocation}</span>` : ''}
          ${state.user.storePhone ? `<span>📞 ${state.user.storePhone}</span>` : ''}
          ${state.user.storeHours ? `<span>🕗 ${state.user.storeHours}</span>` : ''}
          ${state.user.storeBio ? `<span style="opacity: 0.9; line-height: 1.4; margin-top: 2px;">${state.user.storeBio}</span>` : ''}
        </div>
        ` : ''}
      </div>

      <div style="display: flex; gap: 12px;">
        <div style="flex: 1; background: #FFFFFF; padding: 14px; border-radius: 16px; border: 1px solid #C8E6C9; text-align: center;">
          <p style="font-size: 10px; color: #388E3C; font-weight: 700; text-transform: uppercase; margin: 0;">Valor em catálogo</p>
          <p style="font-size: 16px; font-weight: 800; color: #2E7D32; margin: 4px 0 0;">R$ ${totalValue.toFixed(2)}</p>
        </div>
        <div style="flex: 1; background: #FFFFFF; padding: 14px; border-radius: 16px; border: 1px solid #C8E6C9; text-align: center;">
          <p style="font-size: 10px; color: #388E3C; font-weight: 700; text-transform: uppercase; margin: 0;">Estoque total</p>
          <p style="font-size: 16px; font-weight: 800; color: #2E7D32; margin: 4px 0 0;">${totalStock} un.</p>
        </div>
      </div>

      ${myProducts.length === 0 ? `
        <div style="background: #FFFFFF; padding: 36px 20px; text-align: center; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <span style="color: #A5D6A7; display: inline-flex;">${icon('box', 40)}</span>
          <p style="color: #1B5E20; font-size: 15px; font-weight: 700; margin: 0;">Sua loja está vazia</p>
          <p style="color: #388E3C; font-size: 12px; margin: 0; max-width: 280px;">Publique seu primeiro anúncio e comece a vender para outros produtores.</p>
          <button onclick="navigateTo('sell')" style="background: #2E7D32; color: #FFFFFF; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; margin-top: 8px;">+ Criar Anúncio</button>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${myProducts.map(p => `
            <div style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 16px; padding: 12px; display: flex; gap: 12px; align-items: center;">
              <div onclick="openProductDetail('${p.id}')" style="width: 64px; height: 64px; border-radius: 12px; background: ${p.imageBg || '#E8F5E9'}; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; flex-shrink: 0;">
                ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 28px;">${p.imageEmoji || '📦'}</span>`}
              </div>
              <div onclick="openProductDetail('${p.id}')" style="flex: 1; cursor: pointer; overflow: hidden;">
                <p style="font-size: 13px; font-weight: 700; color: #1B5E20; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</p>
                <p style="font-size: 12px; color: #2E7D32; font-weight: 700; margin-top: 2px;">R$ ${Number(p.price).toFixed(2)} / ${p.unit || 'unidade'}</p>
                <p style="font-size: 10px; color: #388E3C; margin-top: 2px;">Estoque: ${p.stock || 0} ${p.unit || 'unidades'} • ${p.location || 'Sem local'}</p>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
                <button onclick="navigateTo('sell')" title="Editar/Republicar" style="background: #E8F5E9; border: 1px solid #A5D6A7; color: #1B5E20; padding: 6px 10px; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;">Novo</button>
                <button onclick="deleteProduct('${p.id}')" title="Excluir anúncio" style="background: #FFEBEE; border: 1px solid #FFCDD2; color: #C62828; padding: 6px 10px; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;">Excluir</button>
              </div>
            </div>
          `).join('')}
        </div>

        <button onclick="navigateTo('sell')" style="width: 100%; background: #2E7D32; color: #FFFFFF; border: none; padding: 14px; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 14px;">+ Publicar Novo Anúncio</button>
      `}
      `}
    </div>
  `;
}

// --- EDITOR DA LOJA (capa, perfil e dados) ---
window.openStoreEditor = function() {
  state.storeEditor = {
    open: true,
    name: state.user.name || '',
    propertyOrCompany: state.user.propertyOrCompany || '',
    storeProfileImage: state.user.storeProfileImage || '',
    storeCoverImage: state.user.storeCoverImage || '',
    storeBio: state.user.storeBio || '',
    storePhone: state.user.storePhone || '',
    storeLocation: state.user.storeLocation || '',
    storeHours: state.user.storeHours || ''
  };
  renderApp();
};

window.closeStoreEditor = function() {
  state.storeEditor = null;
  renderApp();
};

window.updateStoreField = function(field, value) {
  if (state.storeEditor) {
    state.storeEditor[field] = value;
  }
};

window.handleStoreImagePick = function(field, inputId) {
  const input = document.getElementById(inputId);
  const file = input && input.files && input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Imagem muito grande. Escolha um arquivo de até 2 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    updateStoreField(field, reader.result);
    const preview = document.getElementById(inputId + 'Preview');
    if (preview) preview.src = reader.result;
    showToast('Imagem carregada. Salve para aplicar.', 'success');
  };
  reader.readAsDataURL(file);
};

window.saveStore = async function() {
  if (!state.storeEditor) return;
  const form = state.storeEditor;
  if (!form.name || !form.name.trim()) {
    showToast('Informe o seu nome.', 'error');
    return;
  }
  try {
    const response = await updateStore({
      name: form.name,
      propertyOrCompany: form.propertyOrCompany,
      storeProfileImage: form.storeProfileImage || '',
      storeCoverImage: form.storeCoverImage || '',
      storeBio: form.storeBio || '',
      storePhone: form.storePhone || '',
      storeLocation: form.storeLocation || '',
      storeHours: form.storeHours || ''
    });
    state.user = { ...state.user, ...response.user };
    persistUser();
    state.storeEditor = null;
    showToast('Loja atualizada com sucesso!', 'success');
    renderApp();
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar a loja.', 'error');
  }
};

function renderStoreEditor() {
  const f = state.storeEditor;
  if (!f || !f.open) return '';
  const inputStyle = 'width: 100%; padding: 11px 12px; border: 1px solid #C8E6C9; border-radius: 10px; font-size: 13px; background: #F4FBF7; color: #1B5E20; box-sizing: border-box; outline: none; font-family: inherit;';
  const labelStyle = 'font-size: 11px; font-weight: 700; color: #1B5E20; display: block; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.3px;';

  return `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;" onclick="if(event.target === this) closeStoreEditor()">
      <div style="background: #FFFFFF; border-radius: 20px; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-family: 'Outfit', sans-serif; color: #1B5E20; font-size: 18px; font-weight: 700; margin: 0;">Editar minha loja</h3>
          <button onclick="closeStoreEditor()" style="background: #F4FBF7; border: 1px solid #C8E6C9; border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 14px; color: #2E7D32;">✕</button>
        </div>

        <div style="display: flex; gap: 14px;">
          <div style="text-align: center;">
            <img id="storeProfilePreview" src="${f.storeProfileImage || ''}" alt="" style="width: 72px; height: 72px; border-radius: 16px; object-fit: cover; background: #E8F5E9; border: 2px solid #C8E6C9; ${f.storeProfileImage ? '' : 'display: none;'}">
            <label style="display: ${f.storeProfileImage ? 'none' : 'flex'}; width: 72px; height: 72px; border-radius: 16px; background: #E8F5E9; border: 2px dashed #A5D6A7; align-items: center; justify-content: center; font-size: 26px; cursor: pointer;" onclick="document.getElementById('storeProfileInput').click()">🏪</label>
            <button onclick="document.getElementById('storeProfileInput').click()" style="background: #E8F5E9; border: 1px solid #A5D6A7; color: #1B5E20; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; margin-top: 6px;">Perfil</button>
            <input type="file" id="storeProfileInput" accept="image/*" style="display: none;" onchange="handleStoreImagePick('storeProfileImage', 'storeProfileInput')">
          </div>
          <div style="flex: 1; text-align: center;">
            <img id="storeCoverPreview" src="${f.storeCoverImage || ''}" alt="" style="width: 100%; height: 72px; border-radius: 12px; object-fit: cover; border: 2px solid #C8E6C9; ${f.storeCoverImage ? '' : 'display: none;'}">
            <button onclick="document.getElementById('storeCoverInput').click()" style="width: 100%; background: #E8F5E9; border: 2px dashed #A5D6A7; color: #1B5E20; padding: 24px 8px; border-radius: 12px; font-size: 12px; font-weight: 700; cursor: pointer; ${f.storeCoverImage ? 'display: none;' : ''}" id="storeCoverPlaceholder">🖼️ Imagem de capa</button>
            <input type="file" id="storeCoverInput" accept="image/*" style="display: none;" onchange="handleStoreImagePick('storeCoverImage', 'storeCoverInput')">
          </div>
        </div>

        <div>
          <label style="${labelStyle}">Seu nome</label>
          <input value="${(f.name || '').replace(/"/g, '&quot;')}" oninput="updateStoreField('name', this.value)" style="${inputStyle}">
        </div>
        <div>
          <label style="${labelStyle}">Nome da loja / propriedade</label>
          <input value="${(f.propertyOrCompany || '').replace(/"/g, '&quot;')}" oninput="updateStoreField('propertyOrCompany', this.value)" style="${inputStyle}">
        </div>
        <div>
          <label style="${labelStyle}">Localização</label>
          <input value="${(f.storeLocation || '').replace(/"/g, '&quot;')}" placeholder="Ex.: Arcos, MG" oninput="updateStoreField('storeLocation', this.value)" style="${inputStyle}">
        </div>
        <div style="display: flex; gap: 10px;">
          <div style="flex: 1;">
            <label style="${labelStyle}">Telefone</label>
            <input value="${(f.storePhone || '').replace(/"/g, '&quot;')}" placeholder="(00) 00000-0000" oninput="updateStoreField('storePhone', this.value)" style="${inputStyle}">
          </div>
          <div style="flex: 1;">
            <label style="${labelStyle}">Horário</label>
            <input value="${(f.storeHours || '').replace(/"/g, '&quot;')}" placeholder="Ex.: 8h às 18h" oninput="updateStoreField('storeHours', this.value)" style="${inputStyle}">
          </div>
        </div>
        <div>
          <label style="${labelStyle}">Descrição da loja</label>
          <textarea maxlength="500" placeholder="Conte sobre sua produção, especialidades e diferenciais..." oninput="updateStoreField('storeBio', this.value)" style="${inputStyle} min-height: 80px; resize: vertical;">${f.storeBio || ''}</textarea>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 4px;">
          <button onclick="closeStoreEditor()" style="flex: 1; background: #FFFFFF; border: 1px solid #C8E6C9; color: #2E7D32; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px;">Cancelar</button>
          <button onclick="saveStore()" style="flex: 1; background: #2E7D32; border: none; color: #FFFFFF; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px;">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// --- TELA DE PERFIL ---
function renderProfileScreen() {
  const isLoggedIn = state.user && state.user.email && state.user.email.trim() !== '';
  const userName = state.user.name || 'Produtor';
  const userInitial = userName.charAt(0).toUpperCase();

  return `
    <div style="flex: 1; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">

      <div style="margin-bottom: 2px;">
        <p style="font-size: 12px; color: #388E3C; margin-bottom: 2px; font-weight: 600; letter-spacing: 0.3px;">GERENCIAMENTO</p>
        <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 26px; font-weight: 700; margin: 0;">Olá, ${userName.split(' ')[0]}</h2>
      </div>

      <div style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 20px; padding: 18px; display: flex; align-items: center; gap: 16px;">
        <div style="width: 52px; height: 52px; background: #2E7D32; color: #FFFFFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; font-family: 'Outfit', sans-serif;; flex-shrink: 0;">
          ${userInitial}
        </div>
        <div style="overflow: hidden;">
          <h3 style="font-size: 15px; color: #1B5E20; font-weight: 700; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</h3>
          <p style="font-size: 12px; color: #388E3C; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${state.user.email || 'demo@agrotech.com.br'}</p>
        </div>
      </div>

      <!-- ATALHOS: MOEDAS • CUPONS • FAVORITOS • COMPRAR NOVAMENTE -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div onclick="toggleProfileSection('coins')" style="background: #FFFFFF; border: 1px solid ${state.profileSection === 'coins' ? '#2E7D32' : '#C8E6C9'}; border-radius: 18px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.2s;">
          <div>
            <h4 style="font-size: 14px; font-weight: 700; color: #1B5E20; margin: 0;">🪙 Moedas</h4>
            <p style="font-size: 12px; color: #388E3C; margin-top: 2px;">${state.coins} moedas disponíveis</p>
          </div>
          <span style="color: #81C784; font-size: 16px; font-weight: bold;">›</span>
        </div>

        <div onclick="navigateTo('cart')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 18px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.2s;">
          <div>
            <h4 style="font-size: 14px; font-weight: 700; color: #1B5E20; margin: 0;">🏷️ Cupons</h4>
            <p style="font-size: 12px; color: #388E3C; margin-top: 2px;">4 cupons ativos para usar</p>
          </div>
          <span style="color: #81C784; font-size: 16px; font-weight: bold;">›</span>
        </div>

        <div onclick="navigateTo('favorites')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 18px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.2s;">
          <div>
            <h4 style="font-size: 14px; font-weight: 700; color: #1B5E20; margin: 0;">⭐ Meus favoritos</h4>
            <p style="font-size: 12px; color: #388E3C; margin-top: 2px;">${(state.user.favorites || []).length} produto(s) salvos</p>
          </div>
          <span style="color: #81C784; font-size: 16px; font-weight: bold;">›</span>
        </div>

        <div onclick="navigateTo('orders')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 18px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.2s;">
          <div>
            <h4 style="font-size: 14px; font-weight: 700; color: #1B5E20; margin: 0;">🔁 Comprar novamente</h4>
            <p style="font-size: 12px; color: #388E3C; margin-top: 2px;">Escolha um pedido para repetir</p>
          </div>
          <span style="color: #81C784; font-size: 16px; font-weight: bold;">›</span>
        </div>
      </div>

      ${state.profileSection === 'coins' ? `
      <div style="background: #FFF8E1; border: 1px solid #FFE082; border-radius: 14px; padding: 14px; font-size: 12px; color: #7A5A00;">
        <strong>🪙 ${state.coins} moedas AgroTech</strong><br>
        Você ganha 1 moeda a cada R$ 10 em compras. Em breve: troque moedas por descontos no pagamento.
      </div>
      ` : ''}

      ${state.profileSection === 'coupons' ? `
      <div style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
        <p style="font-size: 11px; font-weight: 700; color: #1B5E20; margin: 0;">CUPONS ATIVOS — toque para copiar e usar no carrinho</p>
        ${[
          { code: 'AGRO10', label: '10% OFF', min: 150 },
          { code: 'FRETEGRATIS', label: 'Frete Grátis', min: 400 },
          { code: 'NOVOCLIENTE', label: 'R$ 25 OFF', min: 100 },
          { code: 'COLHEITA20', label: '20% OFF', min: 800 }
        ].map(c => `
          <div onclick="copyCoupon('${c.code}')" style="display: flex; justify-content: space-between; align-items: center; background: #F4FBF7; border: 1px dashed #A5D6A7; border-radius: 10px; padding: 8px 12px; cursor: pointer;">
            <div>
              <span style="font-size: 12px; font-weight: 800; color: #1B5E20;">${c.code}</span>
              <span style="font-size: 10px; color: #6C8574; margin-left: 8px;">mín. R$ ${c.min}</span>
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #2E7D32;">${c.label}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${state.profileSection === 'favorites' ? `
      <div style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
        ${(state.user.favorites || []).length === 0 ? `
          <p style="font-size: 12px; color: #6C8574; margin: 0; text-align: center;">Nenhum favorito ainda. Toque na ⭐ dentro de um anúncio para salvar.</p>
        ` : (state.user.favorites || []).map(fid => {
          const p = state.products.find(x => x.id === fid);
          return p ? `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #F4FBF7; border: 1px solid #E8F5E9; border-radius: 10px; padding: 8px 12px;">
              <span onclick="openProductDetail('${p.id}')" style="font-size: 12px; font-weight: 700; color: #1B5E20; cursor: pointer;">${p.name}</span>
              <div style="display: flex; gap: 6px;">
                <button onclick="addToCart('${p.id}')" style="background: #2E7D32; color: #FFF; border: none; padding: 5px 10px; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;">+ Carrinho</button>
                <button onclick="toggleFavorite('${p.id}')" style="background: #FFEBEE; color: #C62828; border: none; padding: 5px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;">✕</button>
              </div>
            </div>
          ` : '';
        }).join('')}
      </div>
      ` : ''}

      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 4px;">

        <div onclick="navigateTo('orders')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 18px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.2s;">
          <div>
            <h4 style="font-size: 14px; font-weight: 700; color: #1B5E20; margin: 0;">Meus pedidos</h4>
            <p style="font-size: 12px; color: #388E3C; margin-top: 2px;">Histórico e rastreio de insumos</p>
          </div>
          <span style="color: #81C784; font-size: 16px; font-weight: bold;">›</span>
        </div>

        ${isLoggedIn ? `
        <div onclick="handleLogout()" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 18px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform 0.2s;">
          <div>
            <h4 style="font-size: 14px; font-weight: 700; color: #C62828; margin: 0;">Sair da conta</h4>
            <p style="font-size: 12px; color: #E57373; margin-top: 2px;">Encerrar sessão atual</p>
          </div>
          <span style="color: #E57373; font-size: 16px; font-weight: bold;">›</span>
        </div>
        ` : ''}

      </div>

    </div>
  `;
}
// --- TELA DE FAVORITOS ---
function renderFavoritesScreen() {
  const favorites = (state.user.favorites || []).map(fid => state.products.find(x => x.id === fid)).filter(Boolean);

  return `
    <div style="flex: 1; padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button onclick="navigateTo('profile')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 10px; width: 36px; height: 36px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #2E7D32;">←</button>
        <div>
          <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 22px; font-weight: 700; margin: 0;">Meus Favoritos</h2>
          <p style="font-size: 11px; color: #388E3C; margin: 2px 0 0;">${favorites.length} produto(s) salvos</p>
        </div>
      </div>

      ${favorites.length === 0 ? `
        <div style="background: #FFFFFF; padding: 36px 20px; text-align: center; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <span style="font-size: 40px;">⭐</span>
          <p style="color: #1B5E20; font-size: 15px; font-weight: 700; margin: 0;">Nenhum favorito ainda</p>
          <p style="color: #388E3C; font-size: 12px; margin: 0; max-width: 280px;">Toque na estrela ★ dentro de um anúncio para salvar aqui.</p>
          <button onclick="navigateTo('catalog')" style="background: #2E7D32; color: #FFFFFF; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; margin-top: 8px;">Explorar Catálogo</button>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${favorites.map(p => `
            <div style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 16px; padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div onclick="openProductDetail('${p.id}')" style="flex: 1; cursor: pointer; overflow: hidden;">
                <p style="font-size: 13px; font-weight: 700; color: #1B5E20; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</p>
                <p style="font-size: 12px; color: #2E7D32; margin-top: 2px; font-weight: 700;">R$ ${Number(p.price).toFixed(2)} / ${p.unit || 'unidade'}</p>
              </div>
              <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <button onclick="addToCart('${p.id}')" style="background: #2E7D32; color: #FFF; border: none; padding: 8px 12px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer;">+ Carrinho</button>
                <button onclick="toggleFavorite('${p.id}')" style="background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; padding: 8px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer;">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}

    </div>
  `;
}

function renderSupportScreen() {
  return `
    <div style="flex: 1; padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">

      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="navigateTo('catalog')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 10px; width: 36px; height: 36px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #2E7D32;">←</button>
          <div>
            <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 22px; font-weight: 700; margin: 0;">Suporte 24h</h2>
            <p style="font-size: 11px; color: #388E3C; margin: 2px 0 0;">Assistente Virtual & Agrônomos de Plantão</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #2E7D32; font-weight: 700; background: #E8F5E9; padding: 4px 10px; border-radius: 20px; border: 1px solid #A5D6A7;">
          <span style="font-size: 8px;">●</span> online
        </div>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding: 4px 0;">
        ${state.chatMessages.map(msg => `
          <div style="align-self: ${msg.sender === 'user' ? 'flex-end' : 'flex-start'}; background: ${msg.sender === 'user' ? '#2E7D32' : '#FFFFFF'}; color: ${msg.sender === 'user' ? '#FFFFFF' : '#1B5E20'}; border: ${msg.sender === 'user' ? 'none' : '1px solid #C8E6C9'}; padding: 14px 16px; border-radius: ${msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; max-width: 85%; font-size: 13px; line-height: 1.5;">
            ${msg.text}
          </div>
        `).join('')}
      </div>

      <div class="drag-scroll-container" data-drag-scroll="true" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; flex-shrink: 0; scrollbar-width: none;">
        <button onclick="sendChatMessage('Rastrear meu pedido')" style="background: #E8F5E9; border: 1px solid #C8E6C9; color: #1B5E20; font-weight: 600; padding: 9px 14px; border-radius: 20px; font-size: 12px; white-space: nowrap; cursor: pointer;">
          ${icon('truck', 15)} Rastrear Pedido
        </button>
        <button onclick="sendChatMessage('Formas de pagamento')" style="background: #E8F5E9; border: 1px solid #C8E6C9; color: #1B5E20; font-weight: 600; padding: 9px 14px; border-radius: 20px; font-size: 12px; white-space: nowrap; cursor: pointer;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align: -2px; display: inline-block;"><rect x="2" y="5" width="20" height="14" rx="2.5"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="5.5" y1="15" x2="10" y2="15"/></svg> Pagamentos
        </button>
        <button onclick="sendChatMessage('Quais são os cupons e regras de frete?')" style="background: #E8F5E9; border: 1px solid #C8E6C9; color: #1B5E20; font-weight: 600; padding: 9px 14px; border-radius: 20px; font-size: 12px; white-space: nowrap; cursor: pointer;">
          ⇄ Cupons & Frete
        </button>
        <button onclick="sendChatMessage('Trocas e devoluções')" style="background: #E8F5E9; border: 1px solid #C8E6C9; color: #1B5E20; font-weight: 600; padding: 9px 14px; border-radius: 20px; font-size: 12px; white-space: nowrap; cursor: pointer;">
          ↩ Devoluções
        </button>
        <button onclick="sendChatMessage('Gostaria de falar com um atendente humano agora')" style="background: #FFF8E1; border: 1px solid #FFE082; color: #F57F17; font-weight: 700; padding: 9px 14px; border-radius: 20px; font-size: 12px; white-space: nowrap; cursor: pointer;">
          ☏ Atendente Humano
        </button>
      </div>

      <div style="display: flex; gap: 10px; align-items: center; flex-shrink: 0;">
        <input type="text" id="chatInput" onkeydown="if(event.key === 'Enter') sendChatMessage()" placeholder="Digite sua dúvida ou peça um atendente..." style="flex: 1; padding: 13px 16px; border: 1px solid #A5D6A7; border-radius: 25px; font-size: 13px; background: #FFFFFF; outline: none;">
        <button onclick="sendChatMessage()" style="background: #2E7D32; color: #FFFFFF; border: none; padding: 13px 20px; border-radius: 25px; font-weight: 700; cursor: pointer; font-size: 13px;">Enviar</button>
      </div>

    </div>
  `;
}

function renderOrdersScreen() {
  const stagesList = [
    { step: 1, title: 'Pedido Confirmado', desc: 'Pagamento recebido e aprovado' },
    { step: 2, title: 'Insumos em Separação no CD', desc: 'Conferência técnica de lote e embalagem' },
    { step: 3, title: 'Saiu para Entrega', desc: 'Transporte AgroExpress a caminho da fazenda' },
    { step: 4, title: 'Entregue na Fazenda', desc: 'Insumos entregues e descarregados' }
  ];

  return `
    <div style="flex: 1; padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; background: #F4FBF7;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="navigateTo('catalog')" style="background: #FFFFFF; border: 1px solid #C8E6C9; border-radius: 10px; width: 36px; height: 36px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #2E7D32;">←</button>
          <div>
            <h2 style="font-family: 'Outfit', sans-serif;; color: #1B5E20; font-size: 22px; font-weight: 700; margin: 0;">Meus Pedidos</h2>
            <p style="font-size: 11px; color: #388E3C; margin: 2px 0 0;">Rastreamento em 4 estágios em tempo real</p>
          </div>
        </div>
        <span style="background: #E8F5E9; border: 1px solid #A5D6A7; color: #1B5E20; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">
          ${state.orders.length} pedido(s)
        </span>
      </div>

      ${state.orders.length === 0 ? `
        <div style="background: #FFFFFF; padding: 36px 20px; text-align: center; border-radius: 20px; border: 1px solid #C8E6C9; display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <span style="color: #A5D6A7; display: inline-flex;">${icon('box', 36)}</span>
          <p style="color: #1B5E20; font-size: 15px; font-weight: 700; margin: 0;">Nenhum pedido encontrado</p>
          <p style="color: #388E3C; font-size: 12px; margin: 0; max-width: 280px;">Seus pedidos confirmados e o rastreio da entrega aparecerão aqui.</p>
          <button onclick="navigateTo('catalog')" style="background: #2E7D32; color: #FFFFFF; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; margin-top: 8px;">Explorar Catálogo</button>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${state.orders.map(order => {
            const currentStep = Number(order.statusStep || (order.status.toLowerCase().includes('entregue') ? 4 : order.status.toLowerCase().includes('transporte') || order.status.toLowerCase().includes('saiu') ? 3 : order.status.toLowerCase().includes('separação') ? 2 : 1));
            const isLive = Boolean(window.activeTrackingTimers && window.activeTrackingTimers[order.id]);

            return `
              <div style="background: #FFFFFF; border-radius: 20px; border: 1px solid #C8E6C9; padding: 18px; display: flex; flex-direction: column; gap: 14px;">

                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #E8F5E9; padding-bottom: 12px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-family: 'Outfit', sans-serif;; font-size: 16px; font-weight: 700; color: #1B5E20;">${order.id}</span>
                      ${isLive ? `
                        <span style="background: #E8F5E9; color: #2E7D32; border: 1px solid #81C784; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #2E7D32; display: inline-block;"></span>
                          Rastreio Ativo
                        </span>
                      ` : ''}
                    </div>
                    <span style="font-size: 11px; color: #388E3C; margin-top: 2px; display: block;">Data: ${order.date || 'Hoje'}</span>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 15px; font-weight: 800; color: #2E7D32;">R$ ${Number(order.total || 0).toFixed(2)}</span>
                    <span style="background: ${currentStep === 4 ? '#E8F5E9' : '#FFF8E1'}; color: ${currentStep === 4 ? '#1B5E20' : '#F57F17'}; border: 1px solid ${currentStep === 4 ? '#A5D6A7' : '#FFE082'}; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; display: block; margin-top: 4px;">
                      ${order.status}
                    </span>
                  </div>
                </div>

                <div style="background: #F4FBF7; padding: 12px; border-radius: 12px; border: 1px solid #E8F5E9; font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; color: #1B5E20;">
                    <span style="font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">${icon('truck', 14)} Transportadora:</span>
                    <span>${order.carrier || 'AgroExpress Logística Rural'}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; color: #1B5E20;">
                    <span style="font-weight: 600;">🏷️ Código de Rastreio:</span>
                    <span style="font-family: monospace; font-weight: 700; background: #FFFFFF; padding: 1px 6px; border-radius: 6px; border: 1px solid #C8E6C9;">${order.trackingCode || 'BR-AGRO-000000'}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; color: #1B5E20;">
                    <span style="font-weight: 600;">📅 Previsão de Entrega:</span>
                    <span style="font-weight: 700;">${order.estimatedDelivery || 'Em 3 a 5 dias úteis'}</span>
                  </div>
                </div>

                <div>
                  <h4 style="font-size: 12px; font-weight: 700; color: #1B5E20; margin: 0 0 10px; letter-spacing: 0.3px; text-transform: uppercase;">Linha do Tempo (4 Estágios)</h4>
                  <div style="display: flex; flex-direction: column; gap: 12px; position: relative;">
                    ${stagesList.map((st, idx) => {
                      const isCompleted = st.step <= currentStep;
                      const isCurrent = st.step === currentStep;
                      const hasNext = idx < stagesList.length - 1;

                      return `
                        <div style="display: flex; gap: 12px; position: relative;">
                          <div style="display: flex; flex-direction: column; align-items: center; width: 26px;">
                            <div style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; background: ${isCompleted ? '#2E7D32' : '#FFFFFF'}; color: ${isCompleted ? '#FFFFFF' : '#81C784'}; border: 2px solid ${isCompleted ? '#2E7D32' : '#C8E6C9'}; z-index: 2;">
                              ${isCompleted ? '✓' : st.step}
                            </div>
                            ${hasNext ? `
                              <div style="width: 2px; flex: 1; min-height: 20px; background: ${st.step < currentStep ? '#2E7D32' : '#C8E6C9'}; margin: 2px 0;"></div>
                            ` : ''}
                          </div>
                          <div style="flex: 1; padding-bottom: ${hasNext ? '10px' : '0'};">
                            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                              <span style="font-size: 13px; font-weight: ${isCurrent ? '700' : isCompleted ? '600' : '500'}; color: ${isCompleted ? '#1B5E20' : '#81C784'};">
                                ${st.title}
                              </span>
                              ${isCurrent ? `
                                <span style="font-size: 10px; font-weight: 700; color: #2E7D32; background: #E8F5E9; padding: 1px 6px; border-radius: 6px;">
                                  Estágio Atual
                                </span>
                              ` : ''}
                            </div>
                            <p style="font-size: 11px; color: ${isCompleted ? '#388E3C' : '#A5D6A7'}; margin: 2px 0 0; line-height: 1.3;">
                              ${st.desc}
                            </p>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>

                <div style="display: flex; gap: 8px; border-top: 1px solid #E8F5E9; padding-top: 12px;">
                  <button onclick="simulateOrderStep('${order.id}')" style="flex: 1; background: #E8F5E9; border: 1px solid #A5D6A7; color: #1B5E20; padding: 10px 8px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span>⏩</span> Avançar Estágio
                  </button>
                  <button onclick="startOrderLiveTracking('${order.id}')" style="flex: 1; background: ${isLive ? '#C62828' : '#2E7D32'}; color: #FFFFFF; border: none; padding: 10px 8px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span>${isLive ? '⏹️ Pausar' : '⏱️ Rastreio 24h'}</span>
                  </button>
                </div>

                ${order.items && order.items.length ? `
                  <div style="background: #FAFAFA; border: 1px solid #EEEEEE; border-radius: 12px; padding: 10px 12px;">
                    <span style="font-size: 11px; font-weight: 700; color: #616161; text-transform: uppercase; display: block; margin-bottom: 6px;">Itens do Pedido (${order.items.length})</span>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      ${order.items.map(it => `
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #37474F;">
                          <span>${it.name || 'Insumo'} (x${it.quantity || 1})</span>
                          <span style="font-weight: 600;">R$ ${(Number(it.price || 0) * Number(it.quantity || 1)).toFixed(2)}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

// --- RENDERIZADOR PRINCIPAL ---
function renderApp() {
  const totalCartCount = state.cart.reduce((acc, item) => acc + item.quantity, 0);
  const navbarRoot = document.getElementById('navbar-root');
  const mainContent = document.getElementById('main-content');

  if (navbarRoot) {
    if (state.activeScreen === 'register') {
      navbarRoot.innerHTML = '';
    } else {
      navbarRoot.innerHTML = renderNavbar(totalCartCount);
    }
  }

  let screenHTML = '';
  if (state.activeScreen === 'register') screenHTML = renderRegisterScreen();
  else if (state.activeScreen === 'catalog') screenHTML = renderCatalogScreen();
  else if (state.activeScreen === 'cart') screenHTML = renderCartScreen();
  else if (state.activeScreen === 'payment') screenHTML = renderPaymentScreen();
  else if (state.activeScreen === 'finance') screenHTML = renderFinanceScreen();
  else if (state.activeScreen === 'mystore') screenHTML = renderMyStoreScreen();
  else if (state.activeScreen === 'profile') screenHTML = renderProfileScreen();
  else if (state.activeScreen === 'favorites') screenHTML = renderFavoritesScreen();
  else if (state.activeScreen === 'support') screenHTML = renderSupportScreen();
  else if (state.activeScreen === 'orders') screenHTML = renderOrdersScreen();
  else if (state.activeScreen === 'sell') screenHTML = renderSellScreen();

  if (mainContent) {
    mainContent.style.display = 'flex';
    mainContent.style.flexDirection = 'column';
    mainContent.style.flex = '1';
    mainContent.style.overflow = 'hidden';
    mainContent.style.position = 'relative';

    if (state.activeScreen === 'register') {
      mainContent.innerHTML = screenHTML;
    } else {
      mainContent.innerHTML = screenHTML + (state.activeScreen === 'sell' ? '' : renderSellFab()) + renderBottomNav() + renderStoreEditor();
    }
    enableDragToScroll();
  }
}

function enableDragToScroll() {
  const containers = document.querySelectorAll('.drag-scroll-container, [data-drag-scroll="true"]');
  containers.forEach(container => {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    container.addEventListener('mousedown', (e) => {
      isDown = true;
      container.classList.add('is-dragging');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
      isDown = false;
      container.classList.remove('is-dragging');
    });

    container.addEventListener('mouseup', () => {
      isDown = false;
      container.classList.remove('is-dragging');
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5;
      container.scrollLeft = scrollLeft - walk;
    });
  });
}

function renderFallbackScreen(message = 'Carregando AgroTech...') {
  return `
    <div style="flex: 1; padding: 32px 20px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 16px; background: #F4FBF7; text-align: left;">
      <div style="font-size: 14px; color: #1B5E20; font-weight: 700;">${message}</div>
      <button onclick="window.location.reload()" style="background: #2E7D32; color: #FFFFFF; border: none; padding: 12px 18px; border-radius: 12px; font-weight: 700; cursor: pointer;">Recarregar</button>
    </div>
  `;
}

function safeInitApp() {
  try {
    console.log('1. Iniciando renderApp...');
    renderApp();
    console.log('2. renderApp completado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar AgroTech:', error.message, error.stack);
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = renderFallbackScreen(`Erro: ${error.message}`);
    }
  }

  // Sincroniza o catálogo com o servidor (produtos salvos em db.json)
  loadProducts()
    .then((products) => {
      if (Array.isArray(products)) {
        state.products = products;
        persistProducts();
        renderApp();
      }
    })
    .catch((error) => console.warn('Não foi possível sincronizar o catálogo:', error.message));
}

// Inicializar aplicação
console.log('AgroTech iniciando...');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInitApp);
} else {
  safeInitApp();
}
