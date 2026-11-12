// Financeiro (GET e POST /api/finance/entries, spec 05): extrato da conta (compras, vendas e
// lançamentos manuais). O resumo sai de summarizeFinance (packages/domain), a mesma regra da web.
import { apiRequest } from './api.ts';

export type EntryType = 'INCOME' | 'EXPENSE';

export type FinanceEntry = {
  id: string;
  type: EntryType;
  source: 'MANUAL' | 'COMPRA' | 'VENDA';
  title: string;
  amount: number;
  /** Igual ao FinanceEntry de packages/domain/finance.js: null quando o pedido não tem data. */
  date: string | null;
};

export function loadFinance(): Promise<FinanceEntry[]> {
  return apiRequest<FinanceEntry[]>('/finance/entries');
}

export function addFinanceEntry(entry: { title: string; amount: number; type: EntryType }): Promise<FinanceEntry> {
  return apiRequest<FinanceEntry>('/finance/entries', { method: 'POST', body: entry });
}
