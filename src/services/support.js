export function buildSupportReply(userText = '', user = {}) {
  const lower = String(userText).toLowerCase();
  const propName = user.propertyOrCompany || 'sua propriedade';

  if (lower.includes('humano') || lower.includes('atendente') || lower.includes('pessoa') || lower.includes('especialista')) {
    return {
      text: `👨‍🌾 Conectando você a um agrônomo especialista humano para atender a ${propName}... Em instantes você receberá atendimento via chat!`,
      nextScreen: null,
      isHuman: true
    };
  }

  if (lower.includes('rastrear') || lower.includes('rastreio') || lower.includes('pedido') || lower.includes('entrega')) {
    return {
      text: `🚚 O rastreamento de entregas da ${propName} atualiza em tempo real! Direcionando você para a aba Meus Pedidos...`,
      nextScreen: 'orders',
      isHuman: false
    };
  }

  if (lower.includes('formas de pagamento') || lower.includes('pix') || lower.includes('cartao') || lower.includes('cartão') || lower.includes('pagamento') || lower.includes('boleto')) {
    return {
      text: '💳 Aceitamos Pix (liberação imediata), Cartão de Crédito em até 6x sem juros e Boleto Bancário com vencimento em 3 dias úteis.',
      nextScreen: null,
      isHuman: false
    };
  }

  if (lower.includes('frete') || lower.includes('envio') || lower.includes('grátis') || lower.includes('gratis')) {
    return {
      text: '📦 Frete Grátis disponível automaticamente em pedidos acima de R$ 800,00 ou com o cupom FRETEGRATIS em compras acima de R$ 400,00.',
      nextScreen: null,
      isHuman: false
    };
  }

  if (lower.includes('cupom') || lower.includes('desconto') || lower.includes('promocional')) {
    return {
      text: '🏷️ Cupons ativos hoje: AGRO10 (10% OFF), FRETEGRATIS, NOVOCLIENTE (R$ 25 OFF) e COLHEITA20 (20% OFF acima de R$ 800).',
      nextScreen: null,
      isHuman: false
    };
  }

  if (lower.includes('trocas') || lower.includes('devoluções') || lower.includes('troca') || lower.includes('devolver')) {
    return {
      text: '🔄 Oferecemos política de troca simplificada para produtos avariados ou incorretos em até 7 dias após o recebimento na sua propriedade.',
      nextScreen: null,
      isHuman: false
    };
  }

  return {
    text: `Entendi! Para dúvidas mais específicas ou suporte técnico na ${propName}, estou encaminhando seu atendimento para um especialista humano...`,
    nextScreen: null,
    isHuman: true
  };
}

