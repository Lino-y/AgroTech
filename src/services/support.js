// Cérebro do chatbot AgroTech: reconhece a intenção da mensagem e responde
// com texto, sugestões de rápido clique e a ação (navegar para uma tela ou
// transferir para um humano). Puro, sem DOM nem fetch — testável no Node.

// Remove acentos e pontuação para o casamento tolerar "cartão"/"cartao".
function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Cada tópico: sinônimos (qualquer um identifica) e a resposta. A ordem importa
// apenas para desempate — a pontuação escolhe o tópico com mais acertos.
const TOPICS = [
  {
    id: 'human',
    words: ['humano', 'atendente', 'pessoa', 'especialista', 'agrônomo', 'agronomo', 'suporte humano', 'falar com alguém', 'operador'],
    text: () =>
      `👨‍🌾 Claro! Transferindo você para um agrônomo especialista da AgroTech. Em instantes um atendente humano assume o chat. Enquanto isso, posso ajudar com pedidos, pagamentos, frete e cupons.`,
    nextScreen: null,
    isHuman: true
  },
  {
    id: 'tracking',
    words: ['rastreio', 'rastrear', 'rastreamento', 'pedido', 'pedidos', 'entrega', 'entregue', 'chegou', 'envio', 'onde está', 'prazo de entrega', 'status'],
    text: () =>
      `🚚 Você acompanha a entrega em tempo real na aba Meus Pedidos (4 estágios: confirmado → preparado → a caminho → entregue). Levando você até lá...`,
    nextScreen: 'orders',
    isHuman: false
  },
  {
    id: 'payment',
    words: ['pagamento', 'pagar', 'pix', 'cartão', 'cartao', 'crédito', 'credito', 'boleto', 'parcelar', 'parcelado', 'débito'],
    text: () =>
      `💳 Formas de pagamento: Pix (liberação imediata do pedido), Cartão de Crédito em até 6x sem juros e Boleto Bancário com vencimento em 3 dias úteis.`,
    nextScreen: null,
    isHuman: false
  },
  {
    id: 'shipping',
    words: ['frete', 'envio', 'entrega grátis', 'grátis', 'gratis', 'transportadora', 'cif', 'fob'],
    text: () =>
      `📦 Frete Grátis automático em pedidos acima de R$ 800,00, ou use o cupom FRETEGRATIS (sem valor mínimo). Também temos CIF (entrega na porteira) e FOB (retirada na propriedade).`,
    nextScreen: null,
    isHuman: false
  },
  {
    id: 'coupon',
    words: ['cupom', 'cupons', 'desconto', 'promocional', 'promoção', 'promocao', 'voucher', 'barato'],
    text: () =>
      `🏷️ Cupons ativos hoje: AGRO10 (10% OFF acima de R$ 150), FRETEGRATIS (frete grátis), NOVOCLIENTE (R$ 25 OFF acima de R$ 100) e COLHEITA20 (20% OFF acima de R$ 200). Aplique no carrinho!`,
    nextScreen: 'cart',
    isHuman: false
  },
  {
    id: 'exchange',
    words: ['troca', 'trocas', 'devolução', 'devolucao', 'devolver', 'avariado', 'errado', 'defeito', 'arrependi'],
    text: () =>
      `🔄 Troca simplificada: produtos avariados ou diferentes do anunciado podem ser devolvidos em até 7 dias após o recebimento, com reembolso integral ou substituição do lote.`,
    nextScreen: null,
    isHuman: false
  },
  {
    id: 'sell',
    words: ['anunciar', 'vender', 'venda', 'anúncio', 'anuncio', 'publicar', 'cadastrar produto', 'meu produto'],
    text: () =>
      `🌾 Para anunciar, use a aba Vender: informe título, preço, estoque, cidade/UF, modalidade logística e a fotografia do lote (obrigatória). O anúncio sai no catálogo na hora.`,
    nextScreen: 'sell',
    isHuman: false
  },
  {
    id: 'finance',
    words: ['financeiro', 'saldo', 'extrato', 'receita', 'recebimento', 'quanto ganhei', 'lucro', 'vendas'],
    text: (propName) =>
      `📊 O painel financeiro da ${propName} mostra entradas, saídas, saldo e gráfico mensal — tudo ligado ao histórico de pedidos e lançamentos manuais. Abrindo o financeiro...`,
    nextScreen: 'finance',
    isHuman: false
  }
];

const SUGGESTIONS = ['Rastrear pedido', 'Formas de pagamento', 'Cupons de hoje', 'Frete grátis', 'Falar com humano'];

export function buildSupportReply(userText = '', user = {}) {
  const lower = normalize(userText);
  const propName = user.propertyOrCompany || 'sua propriedade';

  // Saudação e agradecimento não merecem transferência humana.
  if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigad|valeu|tchau|ate mais)\b/.test(lower)) {
    return {
      text: `👋 Olá! Sou o AgroBot, assistente 24h da AgroTech. Posso ajudar ${propName} com pedidos, pagamentos, frete, cupons e anúncios. É só perguntar!`,
      nextScreen: null,
      isHuman: false,
      suggestions: SUGGESTIONS
    };
  }

  // Mensagem vazia: convida em vez de escalar.
  if (!lower.trim()) {
    return {
      text: 'Como posso ajudar? Pergunte sobre pedidos, pagamentos, frete, cupons ou anúncios.',
      nextScreen: null,
      isHuman: false,
      suggestions: SUGGESTIONS
    };
  }

  // Pontua cada tópico pelo número de sinônimos citados e escolhe o melhor.
  let best = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    const score = topic.words.reduce((acc, word) => (lower.includes(normalize(word)) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }

  if (best) {
    return {
      text: best.text(propName),
      nextScreen: best.nextScreen,
      isHuman: best.isHuman,
      suggestions: best.isHuman ? [] : SUGGESTIONS.filter(s => s !== 'Falar com humano')
    };
  }

  // Sem tópico reconhecido: responde com o que sabe fazer e oferece o humano
  // (a transferência acontece no próximo clique, não de imediato).
  return {
    text: `🤔 Não tenho uma resposta pronta para isso, mas posso ajudar com pedidos, pagamentos, frete, cupons, trocas e anúncios — ou chamo um especialista humano para você.`,
    nextScreen: null,
    isHuman: false,
    suggestions: [...SUGGESTIONS]
  };
}
