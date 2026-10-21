// @ts-check

/**
 * @typedef {'INCOME' | 'EXPENSE'} EntryType
 * @typedef {{ id: string, type: EntryType, source: 'COMPRA' | 'VENDA' | 'MANUAL', title: string,
 *   amount: number, date: string | null }} FinanceEntry
 * @typedef {{ ownerEmail?: string, price?: number, quantity?: number }} OrderItem
 * @typedef {{ id: string, ownerEmail?: string, total?: number, createdAt?: string, date?: string,
 *   items?: OrderItem[] }} Order
 * @typedef {{ id: string, ownerEmail: string, type: EntryType, title: string, amount: number,
 *   createdAt: string }} StoredEntry
 */

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** @param {Date} date */
const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

/**
 * Data do pedido em ISO. Pedido novo tem `createdAt`; o do seed só tem a data legível
 * ("15/Set/2026"). Pedido antigo gravado com "Hoje" não tem data real: devolve null, e ele
 * fica fora do financeiro, que é recortado por mês.
 * @param {Order} order
 * @returns {string | null}
 */
function orderDate(order) {
  if (order.createdAt) return order.createdAt;
  const match = /^(\d{1,2})\/(\p{L}{3})\/(\d{4})$/u.exec(String(order.date));
  const month = match ? MONTHS.findIndex((name) => name.toLowerCase() === match[2].toLowerCase()) : -1;
  // Meio-dia UTC: o dia não muda em nenhum fuso do Brasil.
  return match && month >= 0 ? new Date(Date.UTC(Number(match[3]), month, Number(match[1]), 12)).toISOString() : null;
}

/**
 * Extrato financeiro de uma conta, do mais recente ao mais antigo: as compras dela (saída),
 * as vendas dos produtos dela em pedidos de outras contas (entrada) e os lançamentos manuais
 * dela. Nada de outra conta entra; o servidor chama com o e-mail da sessão.
 * @param {{ orders?: Order[], financeEntries?: StoredEntry[] }} db
 * @param {string} email
 * @returns {FinanceEntry[]}
 */
export function buildFinanceEntries({ orders = [], financeEntries = [] }, email) {
  /** @type {FinanceEntry[]} */
  const entries = financeEntries
    .filter((entry) => entry.ownerEmail === email)
    .map(({ id, type, title, amount, createdAt }) => ({ id, type, source: 'MANUAL', title, amount, date: createdAt }));

  for (const order of orders) {
    const date = orderDate(order);
    if (order.ownerEmail === email) {
      entries.push({ id: `compra-${order.id}`, type: 'EXPENSE', source: 'COMPRA', title: `Compra no App (${order.id})`, amount: Number(order.total || 0), date });
      continue;
    }
    // ponytail: receita bruta do item (preço x quantidade); cupom e frete são do pedido e não
    // descontam do vendedor. Repasse líquido pede a regra de comissão, que ainda não existe.
    const sold = (order.items || [])
      .filter((item) => item.ownerEmail === email)
      .reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0);
    if (sold > 0) {
      entries.push({ id: `venda-${order.id}`, type: 'INCOME', source: 'VENDA', title: `Venda no App (${order.id})`, amount: sold, date });
    }
  }

  return entries.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/**
 * Resumo da tela financeira. Cards, gráfico, extrato e o card de compras saem da mesma lista:
 * só conta o lançamento cujo mês está no gráfico (os `months` meses até `now`), e os totais são
 * a soma das barras. O tipo recorta só o extrato, que então soma o card do mesmo tipo.
 * @param {FinanceEntry[]} entries extrato de `GET /api/finance/entries`
 * @param {{ months?: number, type?: 'ALL' | EntryType, now?: Date }} [filters]
 */
export function summarizeFinance(entries, { months = 6, type = 'ALL', now = new Date() } = {}) {
  const chart = Array.from({ length: months }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1 + index, 1);
    return { key: monthKey(start), month: MONTHS[start.getMonth()], income: 0, expense: 0 };
  });
  const byMonth = new Map(chart.map((bucket) => [bucket.key, bucket]));

  /** @type {FinanceEntry[]} */
  const inPeriod = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const bucket = entry.date ? byMonth.get(monthKey(new Date(entry.date))) : undefined;
    if (!bucket) continue;
    bucket[entry.type === 'INCOME' ? 'income' : 'expense'] += Number(entry.amount) || 0;
    inPeriod.push(entry);
  }

  const income = chart.reduce((total, bucket) => total + bucket.income, 0);
  const expense = chart.reduce((total, bucket) => total + bucket.expense, 0);
  const purchases = inPeriod.filter((entry) => entry.source === 'COMPRA');
  return {
    income,
    expense,
    balance: income - expense,
    chart,
    entries: type === 'ALL' ? inPeriod : inPeriod.filter((entry) => entry.type === type),
    purchases: { count: purchases.length, total: purchases.reduce((total, entry) => total + (Number(entry.amount) || 0), 0) }
  };
}
