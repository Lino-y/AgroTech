import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { formatDate, formatDateTime, formatPrice } from '../lib/catalog.ts';
import { orderActions, paymentResultMessage } from '../lib/payment.ts';
import { ApiError } from '../services/api.ts';
import { withCache } from '../services/offline.ts';
import { cancelOrderPayment, loadOrders, syncOrderPayment, type Order } from '../services/orders.ts';
import { colors, iconSize } from '../theme.ts';

type Props = {
  onBack: () => void;
  onBrowse: () => void;
  /** Muda quando o app volta do Mercado Pago: recarrega a lista. */
  refreshKey?: number;
  /** "Pagar agora": o App abre a página do Mercado Pago e confere na volta. */
  onPay?: (order: Order) => void;
};

// Meus Pedidos (GET /api/orders): só os da conta logada, com status, rastreio e o total do servidor.
// Pedido do Mercado Pago aguardando pagamento ganha Pagar agora, Conferir pagamento e Cancelar.
export function OrdersScreen({ onBack, onBrowse, refreshKey = 0, onPay }: Props): React.JSX.Element {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Data do dado salvo quando a lista veio do aparelho por falta de rede (null = ao vivo).
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await withCache('cache:orders', loadOrders);
      setOrders(result.data);
      setSavedAt(result.savedAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar os pedidos.');
      setOrders((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Conferir e cancelar falam com o servidor; sem rede, avisam e não mudam nada.
  async function run(order: Order, action: () => Promise<Order>, show: boolean): Promise<void> {
    if (busy) return;
    setBusy(order.id);
    try {
      const updated = await action();
      if (show) {
        const message = paymentResultMessage(updated);
        Alert.alert(message.title, message.body);
      }
      await load();
    } catch (err) {
      Alert.alert('Não deu certo', err instanceof ApiError ? err.message : 'Tente de novo com internet.');
    } finally {
      setBusy(null);
    }
  }

  function confirmCancel(order: Order): void {
    Alert.alert('Cancelar pedido?', `O pedido ${order.id} será cancelado e o estoque liberado.`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => void run(order, () => cancelOrderPayment(order.id), true) }
    ]);
  }

  function renderActions(order: Order): React.JSX.Element | null {
    const actions = orderActions(order);
    if (!actions.pay && !actions.check) return null;
    return (
      <View style={styles.actions}>
        {actions.note ? <Text style={ui.notice}>{actions.note}</Text> : null}
        {actions.pay && onPay ? <Button title="Pagar agora" onPress={() => onPay(order)} /> : null}
        {actions.check ? (
          <Button title="Conferir pagamento" variant="outline" loading={busy === order.id} onPress={() => void run(order, () => syncOrderPayment(order.id), true)} />
        ) : null}
        {actions.cancel ? <Button title="Cancelar pedido" variant="outline" onPress={() => confirmCancel(order)} /> : null}
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Meus pedidos" onBack={onBack} />
      {orders === null ? (
        <View style={ui.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(order) => order.id}
          contentContainerStyle={ui.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            savedAt ? (
              <Text accessibilityLiveRegion="polite" style={ui.notice}>
                Sem conexão: pedidos salvos em {formatDateTime(savedAt)}. Puxe a lista para atualizar.
              </Text>
            ) : error ? (
              <Text style={ui.error}>{error}</Text>
            ) : undefined
          }
          ListEmptyComponent={
            error ? undefined : (
              <View style={ui.center}>
                <Text style={ui.sectionTitle}>Nenhum pedido ainda</Text>
                <Button title="Ver catálogo" variant="outline" onPress={onBrowse} />
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={ui.card}>
              <View style={ui.between}>
                <Text style={styles.id}>{item.id}</Text>
                <Text style={ui.muted}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
              {item.items.map((line) => (
                <Text key={line.id} style={ui.text} numberOfLines={1}>
                  {line.imageEmoji ?? '📦'} {line.quantity}× {line.name}
                </Text>
              ))}
              <View style={ui.between}>
                <Text style={ui.muted}>{item.estimatedDelivery ?? ''}</Text>
                <Text style={styles.total}>{formatPrice(item.total)}</Text>
              </View>
              {renderActions(item)}
              {item.trackingCode && item.paymentStatus !== 'AGUARDANDO_PAGAMENTO' ? <Text style={ui.muted}>Rastreio: {item.trackingCode}</Text> : null}
              {item.timeline?.length ? (
                <View style={styles.timeline} accessibilityLabel="Etapas da entrega">
                  {item.timeline.map((step) => (
                    <View key={step.title} style={ui.row}>
                      <Icon
                        name={step.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={iconSize.sm + 2}
                        color={step.completed ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={step.completed ? styles.stepDone : ui.muted}>
                        {step.title} · {step.completed ? 'feito' : step.time}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  id: { fontSize: 15, fontWeight: '800', color: colors.foreground },
  status: { fontSize: 14, fontWeight: '700', color: colors.primary },
  total: { fontSize: 16, fontWeight: '800', color: colors.primary },
  timeline: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  actions: { gap: 8 },
  stepDone: { fontSize: 13, fontWeight: '700', color: colors.foreground }
});
