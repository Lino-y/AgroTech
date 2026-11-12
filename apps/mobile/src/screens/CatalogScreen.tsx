import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Tap } from '../components/Tap.tsx';
import { Icon } from '../components/Icon.tsx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../services/api.ts';
import { loadProducts, type Product } from '../services/products.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { OFFLINE_CATALOG_DATE, OFFLINE_PRODUCTS } from '../data/offline-catalog.ts';
import {
  ALL_CATEGORIES,
  categoriesOf,
  countLabel,
  filterProducts,
  formatDateTime,
  offlineCatalog,
  shouldUseSnapshot,
  slimProduct,
  snapshotLabel,
  type CatalogSource
} from '../lib/catalog.ts';
import { readCache, saveCache } from '../services/storage.ts';
import { colors, iconSize, MIN_TOUCH, radius } from '../theme.ts';

/** userName: quem está logado; null é visitante (o catálogo é público, como na web). */
type Props = { userName: string | null; onOpenProduct: (product: Product) => void };

// Lista na tela e de onde ela veio: servidor (live), último catálogo salvo no aparelho (cache) ou
// catálogo de demonstração embutido (snapshot), nessa ordem (Fase 3 da spec 08).
const EMPTY: CatalogSource = { items: [], source: 'live', savedAt: null };

export function CatalogScreen({ userName, onOpenProduct }: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<CatalogSource>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const insets = useSafeAreaInsets();

  const load = useCallback(async (fromPullToRefresh: boolean) => {
    if (fromPullToRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const items = await loadProducts();
      setCatalog({ items, source: 'live', savedAt: null });
      // Guarda o catálogo consultado (enxuto) para abrir sem rede da próxima vez.
      void saveCache('cache:catalog', items.map(slimProduct), null);
    } catch (err) {
      // Falha de carga não apaga o que já estava na tela. Sem rede e com a lista vazia, mostra o
      // último catálogo salvo (ou o de demonstração); erro do servidor (4xx/5xx) não troca nada.
      const status = err instanceof ApiError ? err.status : -1;
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o catálogo.');
      const saved = await readCache<Product[]>('cache:catalog', null);
      setCatalog((current) => (shouldUseSnapshot(status, current.items.length) ? offlineCatalog(saved, OFFLINE_PRODUCTS) : current));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const categories = useMemo(() => categoriesOf(catalog.items), [catalog.items]);
  const visible = useMemo(() => filterProducts(catalog.items, term, category), [catalog.items, term, category]);
  const searching = term.trim().length > 0 || category !== ALL_CATEGORIES;

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        {userName ? <Text style={styles.greeting}>Olá, {userName.split(' ')[0]}</Text> : null}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Catálogo de Insumos</Text>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {loading ? '' : countLabel(visible.length)}
          </Text>
        </View>
        <View style={styles.searchBox}>
          <View style={styles.searchIcon} pointerEvents="none">
            <Icon name="search-outline" size={iconSize.sm + 2} color={colors.mutedForeground} />
          </View>
          <TextInput
          accessibilityLabel="Buscar produtos"
          placeholder="Buscar insumos, sementes, máquinas..."
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          autoCorrect={false}
          value={term}
          onChangeText={setTerm}
          style={styles.search}
          />
        </View>
        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[ALL_CATEGORIES, ...categories].map((item) => {
              const selected = category === item;
              return (
                <Tap
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(item)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                </Tap>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {loading && catalog.items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Carregando catálogo...</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Tap
              accessibilityRole="button"
              accessibilityHint="Abre os detalhes e a compra"
              onPress={() => onOpenProduct(item)}
              style={styles.cell}
            >
              <ProductCard product={item} />
            </Tap>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            catalog.source !== 'live' || error ? (
              <View style={styles.boxes}>
                {catalog.source !== 'live' ? (
                  <Text accessibilityLiveRegion="polite" style={styles.notice}>
                    {catalog.source === 'cache'
                      ? `Modo offline: catálogo salvo em ${formatDateTime(catalog.savedAt)}, pode estar desatualizado.`
                      : `Modo offline: catálogo de demonstração de ${snapshotLabel(OFFLINE_CATALOG_DATE)}.`}{' '}
                    Puxe a lista para atualizar quando tiver conexão.
                  </Text>
                ) : null}
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Tap accessibilityRole="button" onPress={() => load(false)} style={styles.retry}>
                      <Text style={styles.retryText}>Tentar novamente</Text>
                    </Tap>
                  </View>
                ) : null}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              {searching ? (
                <>
                  <Text style={styles.hint}>Nenhum resultado para "{term.trim() || category}".</Text>
                  <Tap
                    accessibilityRole="button"
                    onPress={() => {
                      setTerm('');
                      setCategory(ALL_CATEGORIES);
                    }}
                    style={styles.retry}
                  >
                    <Text style={styles.retryText}>Limpar busca</Text>
                  </Tap>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.background, gap: 12 },
  greeting: { fontSize: 13, fontWeight: '600', color: colors.secondaryForeground },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  count: { fontSize: 12, fontWeight: '600', color: colors.secondaryForeground },
  search: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    paddingLeft: 42,
    paddingRight: 16,
    backgroundColor: colors.surface,
    fontSize: 15,
    color: colors.foreground
  },
  searchBox: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  chipTextSelected: { color: colors.onPrimary },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  column: { gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint: { fontSize: 14, color: colors.secondaryForeground, textAlign: 'center' },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  boxes: { gap: 12, marginBottom: 12 },
  notice: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.control,
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.warningForeground
  },
  errorBox: {
    backgroundColor: colors.destructiveSoft,
    borderRadius: radius.control,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.destructive
  },
  errorText: { color: colors.destructive, fontSize: 14, fontWeight: '600' },
  retry: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    borderRadius: radius.control,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start'
  },
  retryText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  cell: { flex: 1 }
});
