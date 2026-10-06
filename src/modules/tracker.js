export const TRACKING_STAGES = [
  'Pedido Confirmado',
  'Insumos em Separação no CD',
  'Saiu para Entrega',
  'Entregue na Fazenda'
];

export class OrderTracker {
  constructor(stages = TRACKING_STAGES) {
    this.stages = stages;
  }

  track(orderId, onStageUpdate, intervalMs = 4000) {
    let current = 0;
    onStageUpdate(current, this.stages[current]);
    const timer = setInterval(() => {
      current++;
      if (current < this.stages.length) {
        onStageUpdate(current, this.stages[current]);
      } else {
        clearInterval(timer);
      }
    }, intervalMs);
    return timer;
  }

  advanceOrder(order) {
    const currentStep = Number(order.statusStep || 1);
    const nextStep = Math.min(this.stages.length, currentStep + 1);
    const nextStatus = this.stages[nextStep - 1];

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const timeline = this.stages.map((stageTitle, idx) => {
      const stepNum = idx + 1;
      const isDone = stepNum <= nextStep;
      return {
        title: stageTitle,
        time: isDone ? (stepNum === nextStep ? `Hoje às ${timeStr}` : 'Concluído') : 'Aguardando',
        completed: isDone
      };
    });

    return {
      ...order,
      statusStep: nextStep,
      status: nextStatus,
      timeline
    };
  }
}
