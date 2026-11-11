import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../services/api.ts';
import { logout } from '../services/auth.ts';
import { loadProducts, type Product } from '../services/products.ts';

type Props = { onLoggedOut: () => void };

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; products: Product[] }
  | { kind: 'error'; message: string };

export function CatalogScreen({ onLoggedOut }: Props): React.JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    loadProducts()
      .then((products) => active && setState({ kind: 'ready', products }))
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Erro ao carregar o catálogo.' });
      });
    return () => {
      active = false;
    };
  }, []);

  async function signOut(): Promise<void> {
    await logout();
    onLoggedOut();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Catálogo</Text>
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>
      {state.kind === 'loading' ? <ActivityIndicator style={styles.center} /> : null}
      {state.kind === 'error' ? <Text style={styles.error}>{state.message}</Text> : null}
      {state.kind === 'ready' ? (
        <FlatList
          data={state.products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum anúncio no momento.</Text>}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, paddingHorizontal: 16, backgroundColor: '#F4FBF7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1B5E20' },
  logout: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  logoutText: { color: '#2E7D32', fontWeight: '700', fontSize: 16 },
  center: { marginTop: 32 },
  error: { color: '#B71C1C', marginTop: 16 },
  empty: { color: '#388E3C', marginTop: 16, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9'
  },
  name: { fontSize: 16, fontWeight: '600', color: '#1B5E20' },
  price: { fontSize: 15, color: '#2E7D32', marginTop: 4 }
});
