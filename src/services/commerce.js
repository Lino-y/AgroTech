export const COUPON_RULES = {
  AGRO10: { type: 'percent', value: 0.10, min: 150, description: '10% OFF acima de R$ 150' },
  FRETEGRATIS: { type: 'free_shipping', min: 400, description: 'Frete Grátis acima de R$ 400' },
  NOVOCLIENTE: { type: 'fixed', value: 25, min: 100, description: 'R$ 25 OFF acima de R$ 100' },
  COLHEITA20: { type: 'percent', value: 0.20, min: 800, description: '20% OFF acima de R$ 800' }
};

export const VALID_COUPONS = Object.keys(COUPON_RULES);

export function validateCouponCode(code, subtotal = 0) {
  const upper = String(code || '').trim().toUpperCase();
  if (!upper) {
    return { valid: false, message: 'Informe o código do cupom.' };
  }
  const rule = COUPON_RULES[upper];
  if (!rule) {
    return { valid: false, message: 'Cupom inválido. Utilize AGRO10, FRETEGRATIS, NOVOCLIENTE ou COLHEITA20.' };
  }
  if (subtotal < rule.min) {
    return {
      valid: false,
      message: `Cupom ${upper} exige valor mínimo de R$ ${rule.min.toFixed(2)}. Subtotal: R$ ${subtotal.toFixed(2)}.`
    };
  }
  return { valid: true, coupon: upper, rule };
}


export function calculateCartSummary(cart = [], appliedCoupon = null) {
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  let discount = 0;
  let freeShipping = subtotal >= 800;

  if (appliedCoupon && COUPON_RULES[appliedCoupon]) {
    const rule = COUPON_RULES[appliedCoupon];
    if (subtotal >= (rule.min || 0)) {
      if (rule.type === 'percent') {
        discount = subtotal * rule.value;
      }
      if (rule.type === 'fixed') {
        discount = rule.value;
      }
      if (rule.type === 'free_shipping') {
        freeShipping = true;
      }
    }
  }

  const shipping = freeShipping || subtotal === 0 ? 0 : 35;
  const total = Math.max(0, subtotal - discount) + shipping;

  return {
    subtotal,
    discount,
    shipping,
    total,
    freeShipping,
    hasCoupon: Boolean(appliedCoupon)
  };
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function normalizeUser(payload = {}) {
  return {
    id: payload.id || `usr-${Date.now()}`,
    name: String(payload.name || '').trim(),
    propertyOrCompany: String(payload.propertyOrCompany || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    password: String(payload.password || ''),
    role: payload.role || 'PRODUTOR'
  };
}

export function buildDefaultProducts() {
  return [
    {
      id: '1',
      name: 'Ração Bovinos Corte 30kg',
      price: 89.90,
      unit: 'saca 30kg',
      location: 'Rio Verde - GO',
      stock: 240,
      shippingType: 'CIF - Entrega na Fazenda',
      certification: 'Registro MAPA nº GO-09123 • Laudo Nutricional',
      sellerName: 'Cooperativa Agropecuária do Sudoeste',
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
      ]
    },
    {
      id: '2',
      name: 'Fertilizante NPK 10-10-10 50kg',
      price: 150.00,
      unit: 'saca 50kg',
      location: 'Patrocínio - MG',
      stock: 180,
      shippingType: 'CIF - Frota AgroExpress',
      certification: 'Garantia de Teores MAPA nº MG-00431 • Emite NF-e',
      sellerName: 'Agro Insumos Cerrado',
      category: 'Fertilizantes',
      image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=80',
      imageEmoji: '🧪',
      imageBg: '#E8F5E9',
      rating: 4.9,
      reviewsCount: 54,
      description: 'Formulação equilibrada ideal para plantio e manutenção de diversas culturas agrícolas, promovendo enraizamento forte.',
      comments: [
        { author: 'Sítio Boa Esperança', text: 'Usamos no milho e o desenvolvimento foliar foi surpreendente.', rating: 5 }
      ]
    },
    {
      id: '3',
      name: 'Semente de Milho Híbrido 20kg',
      price: 450.00,
      unit: 'saca 20kg (60 mil sementes)',
      location: 'Cascavel - PR',
      stock: 95,
      shippingType: 'CIF - Carga Refrigerada',
      certification: 'Germinação 96% • Pureza 99,8% • MAPA PR-8821',
      sellerName: 'Sementes Santa Maria',
      category: 'Grãos',
      image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=80',
      imageEmoji: '🌽',
      imageBg: '#F1F8E9',
      rating: 4.7,
      reviewsCount: 18,
      description: 'Sementes tratadas com alta tolerância a pragas e seca, garantindo teto produtivo elevado para grãos e silagem.',
      comments: [
        { author: 'Fazenda Santa Maria', text: 'Germinação acima de 95%. Recomendo.', rating: 5 }
      ]
    },
    {
      id: '4',
      name: 'Trator Fruteiro 75cv (Diária)',
      price: 800.00,
      unit: 'diária de locação',
      location: 'Ribeirão Preto - SP',
      stock: 3,
      shippingType: 'FOB - Retirada na Garagem Agrícola',
      certification: 'Revisão de 250h Concluída • Seguro Máquina Incluso',
      sellerName: 'AgroLoc Locações de Maquinário',
      category: 'Máquinas',
      image: 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&w=900&q=80',
      imageEmoji: '🚜',
      imageBg: '#E0F2F1',
      rating: 5.0,
      reviewsCount: 12,
      description: 'Aluguel por diária de trator compacto ideal para pomares e cafezais, equipado com tomada de força e tração 4x4.',
      comments: [
        { author: 'Agro Cafezal', text: 'Equipamento revisado e entregue no prazo na fazenda.', rating: 5 }
      ]
    }
  ];
}
