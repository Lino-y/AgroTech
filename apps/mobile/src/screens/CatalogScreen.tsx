import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { ApiError } from '../services/api.ts';
import { logout } from '../services/auth.ts';
import { loadProducts, type Product } from '../services/products.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { ALL_CATEGORIES, categoriesOf, countLabel, filterProducts } from '../lib/catalog.ts';
import { colors, MIN_TOUCH, radius } from '../theme.ts';

type Props = { onLoggedOut: () => void };

// Espaço da barra de status (no Android, o conteúdo sobe por baixo dela quando o app é de ponta a ponta).
const TOP_INSET = (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 44) + 12;

export function CatalogScreen({ onLoggedOut }: Props): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const load = useCallback(async (fromPullToRefresh: boolean) => {
    if (fromPullToRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setProducts(await loadProducts());
    } catch (err) {
      // Falha de carga não apaga o que já estava na tela: mostra o erro e deixa tentar de novo.
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o catálogo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const categories = useMemo(() => categoriesOf(products), [products]);
  const visible = useMemo(() => filterProducts(products, term, category), [products, term, category]);
  const searching = term.trim().length > 0 || category !== ALL_CATEGORIES;

  async function signOut(): Promise<void> {
    await logout();
    onLoggedOut();
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: TOP_INSET }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Catálogo de Insumos</Text>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {loading ? '' : countLabel(visible.length)}
          </Text>
        </View>
        <TextInput
          accessibilityLabel="Buscar produtos"
          placeholder="Buscar insumos, sementes, máquinas..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          value={term}
          onChangeText={setTerm}
          style={styles.search}
        />
        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[ALL_CATEGORIES, ...categories].map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(item)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {loading && products.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.hint}>Carregando catálogo...</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductCard product={item} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.green} />
          }
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={() => load(false)} style={styles.retry}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              {searching ? (
                <>
                  <Text style={styles.hint}>Nenhum resultado para "{term.trim() || category}".</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setTerm('');
                      setCategory(ALL_CATEGORIES);
                    }}
                    style={styles.retry}
                  >
                    <Text style={styles.retryText}>Limpar busca</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.hint}>
                  {error ? 'Não foi possível mostrar os anúncios.' : 'Nenhum anúncio no momento.'}
                </Text>
              )}
            </View>
          }
        />
      )}

      <View style={styles.bottomBar}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} style={styles.tab}>
          <Text style={[styles.tabText, styles.tabTextSelected]}>Catálogo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.tab}>
          <Text style={styles.tabText}>Sair</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.paper, gap: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.greenDark },
  count: { fontSize: 12, fontWeight: '600', color: colors.greenMuted },
  search: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    fontSize: 15,
    color: colors.greenDark
  },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.green },
  chipTextSelected: { color: colors.white },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  column: { gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint: { fontSize: 14, color: colors.greenMuted, textAlign: 'center' },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.control,
    padding: 14,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.danger
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  retry: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    borderRadius: radius.control,
    backgroundColor: colors.green,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start'
  },
  retryText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 12,
    paddingTop: 6
  },
  tab: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextSelected: { color: colors.greenDark, fontWeight: '800' }
});
