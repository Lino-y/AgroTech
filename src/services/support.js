// Árvore de decisão do chatbot: cada regra é uma lista de palavras-chave. A ordem importa —
// a primeira regra cuja palavra aparece na mensagem vence; sem nenhuma, oferece sugestões.
const SUGGESTIONS = ['Rastrear pedido', 'Formas de pagamento', 'Cupons de hoje', 'Frete grátis', 'Falar com humano'];
// Saudações e vazios respondem com convite, sem escalar.
const greeting = () => ({
  text: '👋 Olá! Sou o AgroBot, assistente 24h da AgroTech. Posso ajudar com pedidos, pagamentos, frete, cupons e anúncios. É só perguntar!',
  nextScreen: null,
  isHuman: false,
  suggestions: SUGGESTIONS
});
const RULES = [
  {
    keywords: ['humano', 'atendente', 'pessoa', 'especialista'],
    text: (propName) => `👨‍🌾 Conectando você a um agrônomo especialista humano para atender a ${propName}... Em instantes você receberá atendimento via chat!`,
    nextScreen: null,
    isHuman: true
  },
  {
    keywords: ['rastrear', 'rastreio', 'pedido', 'entrega'],
    text: (propName) => `🚚 O rastreamento de entregas da ${propName} atualiza em tempo real! Direcionando você para a aba Meus Pedidos...`,
    nextScreen: 'orders',
    isHuman: false
  },
  {
    keywords: ['formas de pagamento', 'pix', 'cartao', 'cartão', 'pagamento', 'boleto'],
    text: () => '💳 Aceitamos Pix (liberação imediata), Cartão de Crédito em até 6x sem juros e Boleto Bancário com vencimento em 3 dias úteis.',
    nextScreen: null,
    isHuman: false
  },
  {
    keywords: ['frete', 'envio', 'grátis', 'gratis'],
    text: () => '📦 Frete Grátis automático em pedidos acima de R$ 800,00, ou cupom FRETEGRATIS em compras a partir de R$ 0,00. Também temos CIF (entrega na porteira) e FOB (retirada na propriedade).',
    nextScreen: null,
    isHuman: false
  },
  {
    keywords: ['cupom', 'desconto', 'promocional'],
    text: () => '🏷️ Cupons ativos hoje: AGRO10 (10% OFF a partir de R$ 150), FRETEGRATIS (frete grátis, mínimo R$ 0,00), NOVOCLIENTE (R$ 25 OFF a partir de R$ 100) e COLHEITA20 (20% OFF a partir de R$ 200).',
    nextScreen: 'cart',
    isHuman: false
  },
  {
    keywords: ['trocas', 'devoluções', 'troca', 'devolver'],
    text: () => '🔄 Oferecemos política de troca simplificada para produtos avariados ou incorretos em até 7 dias após o recebimento na sua propriedade.',
    nextScreen: null,
    isHuman: false
  },
  {
    keywords: ['financeiro', 'saldo', 'extrato', 'receita', 'recebimento', 'quanto ganhei', 'lucro', 'vendas'],
    text: (propName) => `📊 O painel financeiro da ${propName} mostra entradas, saídas, saldo e gráfico mensal — tudo ligado ao histórico de pedidos e lançamentos manuais. Abrindo o financeiro...`,
    nextScreen: 'finance',
    isHuman: false
  },
  {
    keywords: ['anunciar', 'vender', 'venda', 'anúncio', 'anuncio', 'publicar', 'cadastrar produto', 'meu produto'],
    text: () => '🌾 Para anunciar, use a aba Vender: informe título, preço, estoque, cidade/UF, modalidade logística e a fotografia do lote (obrigatória). O anúncio sai no catálogo na hora.',
    nextScreen: 'sell',
    isHuman: false
  }
];

export function buildSupportReply(userText = '', user = {}) {
  const lower = String(userText).toLowerCase().trim();
  const propName = user.propertyOrCompany || 'sua propriedade';

  // Saudação e agradecimento não merecem transferência humana.
  if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigad|valeu|tchau|ate mais)\b/.test(lower) || !lower) {
    return greeting();
  }

  const rule = RULES.find(({ keywords }) => keywords.some((word) => lower.includes(word)));
  if (rule) {
    return { text: rule.text(propName), nextScreen: rule.nextScreen, isHuman: rule.isHuman, suggestions: SUGGESTIONS };
  }

  // Tópico desconhecido não transfere de imediato: oferece sugestões e o humano.
  return {
    text: '🤔 Não tenho uma resposta pronta para isso, mas posso ajudar com pedidos, pagamentos, frete, cupons, trocas e anúncios — ou chamo um especialista humano para você.',
    nextScreen: null,
    isHuman: false,
    suggestions: SUGGESTIONS
  };
}
