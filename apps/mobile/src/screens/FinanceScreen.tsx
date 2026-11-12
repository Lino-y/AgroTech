import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tap } from '../components/Tap.tsx';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { summarizeFinance } from '../domain.ts';
import { formatDate, formatDateTime, formatPrice } from '../lib/catalog.ts';
import { parsePriceBR } from '../lib/sell.ts';
import { ApiError } from '../services/api.ts';
import { withCache } from '../services/offline.ts';
import { addFinanceEntry, loadFinance, type EntryType, type FinanceEntry } from '../services/finance.ts';
import { colors, radius } from '../theme.ts';

const FILTERS: { value: 'ALL' | EntryType; label: string }[] = [
  { value: 'ALL', label: 'Tudo' },
  { value: 'INCOME', label: 'Receitas' },
  { value: 'EXPENSE', label: 'Despesas' }
];

// Gestão financeira: extrato da conta (GET /api/finance/entries) resumido por summarizeFinance, a
// mesma regra da web (últimos 6 meses), e lançamento manual (POST).
export function FinanceScreen(): React.JSX.Element {
  const [entries, setEntries] = useState<FinanceEntry[] | null>(null);
  const [filter, setFilter] = useState<'ALL' | EntryType>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<EntryType>('EXPENSE');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await withCache('cache:finance', loadFinance);
      setEntries(result.data);
      setSavedAt(result.savedAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o financeiro.');
      setEntries((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeFinance(entries ?? [], { type: filter }), [entries, filter]);
  const biggest = Math.max(1, ...summary.chart.map((bucket) => Math.max(bucket.income, bucket.expense)));

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function save(): Promise<void> {
    if (saving) return;
    const value = parsePriceBR(amount);
    if (!title.trim()) return setFormError('Informe a descrição.');
    if (!Number.isFinite(value) || value <= 0) return setFormError('Informe um valor maior que zero.');
    setSaving(true);
    setFormError(null);
    try {
      await addFinanceEntry({ title: title.trim(), amount: value, type });
      setTitle('');
      setAmount('');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o lançamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Financeiro" subtitle="Últimos 6 meses" />
      {entries === null ? (
        <View style={ui.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={ui.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          {savedAt ? (
            <Text accessibilityLiveRegion="polite" style={ui.notice}>
              Sem conexão: extrato salvo em {formatDateTime(savedAt)}. Lançamentos novos só com internet.
            </Text>
          ) : null}
          {error ? <Text style={ui.error}>{error}</Text> : null}

          <View style={styles.cards}>
            <SummaryCard label="Receitas" value={summary.income} color={colors.primary} />
            <SummaryCard label="Despesas" value={summary.expense} color={colors.destructive} />
          </View>
          <SummaryCard label="Saldo" value={summary.balance} color={summary.balance >= 0 ? colors.primary : colors.destructive} />

          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Receitas e despesas por mês</Text>
            {/* Legenda: a cor não é a única pista (barra da esquerda = receita, da direita = despesa). */}
            <View style={ui.row}>
              <View style={[styles.swatch, styles.income]} />
              <Text style={ui.muted}>Receitas (esquerda)</Text>
              <View style={[styles.swatch, styles.expense]} />
              <Text style={ui.muted}>Despesas (direita)</Text>
            </View>
            <View style={styles.chart} accessibilityLabel="Gráfico de receitas e despesas dos últimos 6 meses">
              {summary.chart.map((bucket) => (
                <View key={bucket.key} style={styles.month}>
                  <View style={styles.bars}>
                    <View style={[styles.bar, styles.income, { height: (bucket.income / biggest) * 90 }]} />
                    <View style={[styles.bar, styles.expense, { height: (bucket.expense / biggest) * 90 }]} />
                  </View>
                  <Text style={ui.muted}>{bucket.month}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Novo lançamento</Text>
            <View style={ui.row}>
              {(['INCOME', 'EXPENSE'] as const).map((value) => {
                const selected = type === value;
                return (
                  <Tap
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    onPress={() => setType(value)}
                    style={[ui.chip, styles.flex, selected && ui.chipSelected]}
                  >
                    <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{value === 'INCOME' ? 'Receita' : 'Despesa'}</Text>
                  </Tap>
                );
              })}
            </View>
            <Field label="DESCRIÇÃO" placeholder="Ex: Diesel do trator" value={title} onChangeText={setTitle} />
            <Field label="VALOR (R$)" keyboardType="decimal-pad" placeholder="Ex: 300,00" value={amount} onChangeText={setAmount} />
            {formError ? <Text style={ui.error}>{formError}</Text> : null}
            <Button title="Salvar lançamento" onPress={save} loading={saving} />
          </View>

          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Extrato</Text>
            <View style={ui.row}>
              {FILTERS.map((item) => {
                const selected = filter === item.value;
                return (
                  <Tap
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(item.value)}
                    style={[ui.chip, selected && ui.chipSelected]}
                  >
                    <Text style={[ui.chipText, selected && ui.chipTextSelected]}>{item.label}</Text>
                  </Tap>
                );
              })}
            </View>
            {summary.entries.length === 0 ? <Text style={ui.muted}>Nenhum lançamento no período.</Text> : null}
            {summary.entries.map((entry) => (
              <View key={entry.id} style={styles.entry}>
                <View style={styles.flex}>
                  <Text style={ui.text} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={ui.muted}>
                    {formatDate(entry.date)} · {entry.source === 'MANUAL' ? 'Manual' : entry.source === 'COMPRA' ? 'Compra' : 'Venda'}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: entry.type === 'INCOME' ? colors.primary : colors.destructive }]}>
                  {entry.type === 'INCOME' ? '+' : '−'} {formatPrice(Number(entry.amount))}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }): React.JSX.Element {
  return (
    <View style={[ui.card, styles.flex]}>
      <Text style={ui.muted}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{formatPrice(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  cardValue: { fontSize: 18, fontWeight: '800' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, paddingTop: 8 },
  month: { alignItems: 'center', gap: 4, flex: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90 },
  bar: { width: 10, borderRadius: 3, minHeight: 2 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  income: { backgroundColor: colors.primary },
  expense: { backgroundColor: colors.destructive },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.primarySoft,
    borderRadius: radius.field
  },
  amount: { fontSize: 15, fontWeight: '800' }
});
