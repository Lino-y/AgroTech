export class SupportBot {
  constructor() {
    this.responses = {
      'rastreio': 'Acompanhe seu pedido no menu Order Tracker em até 4 estágios.',
      'pedido': 'Acompanhe seu pedido no menu Order Tracker em até 4 estágios.',
      'pagamento': 'Aceitamos Pix (imediato), Cartão em até 6x sem juros e Boleto Bancário.',
      'pix': 'O pagamento por Pix é processado imediatamente com confirmação em tempo real.',
      'cartao': 'Parcelamento no cartão de crédito em até 6x sem juros.',
      'cartão': 'Parcelamento no cartão de crédito em até 6x sem juros.',
      'boleto': 'O boleto bancário tem vencimento em 3 dias úteis.',
      'frete': 'Frete grátis em pedidos acima de R$ 800,00 ou com o cupom FRETEGRATIS (mínimo R$ 400,00).',
      'cupom': 'Cupons disponíveis: AGRO10 (10% OFF), FRETEGRATIS, NOVOCLIENTE (R$ 25 OFF) e COLHEITA20 (20% OFF).',
      'troca': 'Política de troca simplificada em até 7 dias após a entrega na fazenda.',
      'devolu': 'Política de troca simplificada em até 7 dias após a entrega na fazenda.'
    };
  }

  reply(message) {
    const text = String(message || '').toLowerCase();

    if (text.includes('humano') || text.includes('atendente') || text.includes('especialista') || text.includes('falar com pessoa')) {
      return {
        text: 'Um momento, estou transferindo você para um agrônomo ou atendente humano especializado da nossa equipe...',
        isHuman: true
      };
    }

    for (let key in this.responses) {
      if (text.includes(key)) {
        return { text: this.responses[key], isHuman: false };
      }
    }

    return {
      text: 'Não encontrei uma resposta exata para sua dúvida no sistema automatizado. Deseja falar com um atendente humano?',
      isHuman: true
    };
  }
}
