import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { formatDate, formatPrice } from '../lib/catalog.ts';
import { parseFeePercent, refundCandidates } from '../lib/payment.ts';
import { loadFeeSettings, refundOrder, saveFeeSettings } from '../services/admin.ts';
import { ApiError } from '../services/api.ts';
import { loadOrders, type Order } from '../services/orders.ts';
import { colors } from '../theme.ts';

type Props = { onBack: () => void };

const message = (err: unknown, fallback: string): string => (err instanceof ApiError ? err.message : fallback);

// Master (ADMIN, spec 10): comissão da AgroTech e estorno (RF-08). O servidor só aceita ADMIN; o
// estorno é pedido ao Mercado Pago e o pedido muda quando ele confirmar.
export function AdminPaymentsScreen({ onBack }: Props): React.JSX.Element {
  const [feeText, setFeeText] = useState('');
  const [feeMessage, setFeeMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [settings, all] = await Promise.all([loadFeeSettings(), loadOrders()]);
      setFeeText(String(settings.marketplaceFeePercent).replace('.', ','));
      setOrders(all);
    } catch (err) {
      setError(message(err, 'Erro ao carregar os pagamentos.'));
      setOrders((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveFee(): Promise<void> {
    const percent = parseFeePercent(feeText);
    if (percent === null) {
      setFeeMessage({ ok: false, text: 'A comissão vai de 0 a 30%, com até 2 casas (ex.: 10 ou 12,5).' });
      return;
    }
    try {
      await saveFeeSettings(percent);
      setFeeMessage({ ok: true, text: `Comissão salva: ${String(percent).replace('.', ',')}% nos próximos pedidos.` });
    } catch (err) {
      setFeeMessage({ ok: false, text: message(err, 'Não foi possível salvar a comissão.') });
    }
  }

  function confirmRefund(order: Order, kind: 'revisao' | 'pago'): void {
    const what = kind === 'pago' ? `o pedido ${order.id} (${formatPrice(order.total)})` : `o pagamento em revisão do pedido ${order.id}`;
    Alert.alert(
      'Estornar?',
      `Estornar ${what}? A devolução ao comprador sai dividida de forma proporcional entre o vendedor e a comissão da AgroTech. Se o vendedor não tiver saldo, o Mercado Pago pode recusar.`,
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Estornar', style: 'destructive', onPress: () => void refund(order) }
      ]
    );
  }

  async function refund(order: Order): Promise<void> {
    setBusy(order.id);
    try {
      Alert.alert('Estorno pedido', (await refundOrder(order.id)).message);
      await load();
    } catch (err) {
      Alert.alert('Estorno não feito', message(err, 'Tente de novo com internet.'));
    } finally {
      setBusy(null);
    }
  }

  const candidates = orders ? refundCandidates(orders) : [];

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Pagamentos" subtitle="Comissão e estornos do Mercado Pago" onBack={onBack} />
      {orders === null ? (
        <View style={ui.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => `${item.kind}-${item.order.id}`}
          contentContainerStyle={ui.scroll}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={ui.card}>
                <Field label="COMISSÃO DA AGROTECH (%)" keyboardType="decimal-pad" value={feeText} onChangeText={setFeeText} placeholder="Ex: 10" />
                <Button title="Salvar comissão" variant="outline" onPress={saveFee} />
                {feeMessage ? <Text style={feeMessage.ok ? ui.success : ui.error}>{feeMessage.text}</Text> : null}
                <Text style={ui.muted}>Vale para os pedidos novos; cada pedido guarda a comissão do dia em que foi feito.</Text>
              </View>
              {error ? <Text style={ui.error}>{error}</Text> : null}
              <Text style={ui.sectionTitle}>Para estornar</Text>
            </View>
          }
          ListEmptyComponent={<Text style={ui.muted}>Nenhum pedido pago ou pagamento em revisão.</Text>}
          renderItem={({ item }) => (
            <View style={ui.card}>
              <View style={ui.between}>
                <Text style={styles.id}>{item.order.id}</Text>
                <Text style={ui.muted}>{formatDate(item.order.createdAt)}</Text>
              </View>
              <Text style={item.kind === 'revisao' ? styles.review : styles.paid}>
                {item.kind === 'revisao' ? `Em revisão: ${item.order.paymentReview?.reason ?? ''}` : 'Pago'}
              </Text>
              <Text style={ui.muted}>Comprador: {item.order.ownerEmail ?? '-'} · Vendedor: {item.order.sellerEmail ?? '-'}</Text>
              <Text style={styles.total}>{formatPrice(item.order.total)}</Text>
              <Button title="Estornar" variant="outline" loading={busy === item.order.id} onPress={() => confirmRefund(item.order, item.kind)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12 },
  id: { fontSize: 15, fontWeight: '800', color: colors.foreground },
  paid: { fontSize: 14, fontWeight: '700', color: colors.primary },
  review: { fontSize: 14, fontWeight: '700', color: colors.warningForeground },
  total: { fontSize: 16, fontWeight: '800', color: colors.primary }
});
