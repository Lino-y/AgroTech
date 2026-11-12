import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { formatDate, formatPrice } from '../lib/catalog.ts';
import { ApiError } from '../services/api.ts';
import { loadOrders, type Order } from '../services/orders.ts';
import { colors } from '../theme.ts';

type Props = { onBack: () => void; onBrowse: () => void };

// Meus Pedidos (GET /api/orders): só os da conta logada, com status, rastreio e o total do servidor.
export function OrdersScreen({ onBack, onBrowse }: Props): React.JSX.Element {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOrders(await loadOrders());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar os pedidos.');
      setOrders((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Meus pedidos" onBack={onBack} />
      {orders === null ? (
        <View style={ui.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(order) => order.id}
          contentContainerStyle={ui.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} />}
          ListHeaderComponent={error ? <Text style={ui.error}>{error}</Text> : undefined}
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
              {item.trackingCode ? <Text style={ui.muted}>Rastreio: {item.trackingCode}</Text> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  id: { fontSize: 15, fontWeight: '800', color: colors.greenDark },
  status: { fontSize: 14, fontWeight: '700', color: colors.green },
  total: { fontSize: 16, fontWeight: '800', color: colors.green }
});
