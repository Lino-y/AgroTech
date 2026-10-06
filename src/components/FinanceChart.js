function formatMoney(value) {
  if (!value) return '—';
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`;
  return `R$ ${Math.round(value)}`;
}

export function renderFinanceChart(data = []) {
  const normalized = (Array.isArray(data) ? data : []).map(item => ({
    month: item.month,
    income: Number(item.income ?? item.percentage ?? 0),
    expense: Number(item.expense ?? item.percentage ?? 0)
  }));

  const maxValue = Math.max(...normalized.flatMap(item => [item.income, item.expense]), 1);

  return `
    <div style="background: #FFFFFF; padding: 16px; border-radius: 12px; border: 1px solid #E2E8F0; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <h3 style="font-size: 14px; color: #1F3D2B; font-weight: bold; font-family: 'Public Sans', sans-serif; margin: 0;">Movimentação Mensal</h3>
        <div style="display: flex; gap: 8px; align-items: center; font-size: 10px; color: #64748B;">
          <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 999px; background: #EAF7EE; color: #1F7A3F; border: 1px solid rgba(46,125,50,0.14); font-weight: 700;">
            <span style="width: 8px; height: 8px; border-radius: 2px; background: #2E7D32; display: inline-block;"></span>Entrada
          </span>
          <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 999px; background: #FFF1F3; color: #C62828; border: 1px solid rgba(198,40,40,0.12); font-weight: 700;">
            <span style="width: 8px; height: 8px; border-radius: 2px; background: #C62828; display: inline-block;"></span>Saída
          </span>
        </div>
      </div>

      <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 130px; gap: 10px; padding-top: 10px; border-bottom: 1px solid #CBD5E1;">
        ${normalized.map(item => `
          <div style="flex: 1; display: flex; align-items: flex-end; justify-content: center; height: 100%; gap: 5px;">
            <div style="display: flex; flex-direction: column; justify-content: flex-end; align-items: center; width: 18px; height: 100%;">
              <span style="font-size: 9px; color: #1F3D2B; font-weight: bold; margin-bottom: 4px;">${formatMoney(item.income)}</span>
              <div style="width: 100%; max-width: 12px; background: #2E7D32; height: ${(item.income / maxValue) * 100}%; border-radius: 5px 5px 0 0; transition: height 0.3s ease;"></div>
            </div>
            <div style="display: flex; flex-direction: column; justify-content: flex-end; align-items: center; width: 18px; height: 100%;">
              <span style="font-size: 9px; color: #1F3D2B; font-weight: bold; margin-bottom: 4px;">${formatMoney(item.expense)}</span>
              <div style="width: 100%; max-width: 12px; background: #C62828; height: ${(item.expense / maxValue) * 100}%; border-radius: 5px 5px 0 0; transition: height 0.3s ease;"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: space-between; padding: 0 2px;">
        ${normalized.map(item => `
          <span style="flex: 1; text-align: center; font-size: 11px; color: #64748B; font-weight: 600;">${item.month}</span>
        `).join('')}
      </div>
    </div>
  `;
}