import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { ApiError } from '../services/api.ts';
import { logout } from '../services/auth.ts';
import { loadProducts, type Product } from '../services/products.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { OFFLINE_CATALOG_DATE, OFFLINE_PRODUCTS } from '../data/offline-catalog.ts';
import {
  ALL_CATEGORIES,
  categoriesOf,
  countLabel,
  filterProducts,
  shouldUseSnapshot,
  snapshotLabel
} from '../lib/catalog.ts';
import { colors, MIN_TOUCH, radius, STATUS_BAR_INSET } from '../theme.ts';

/** userName: quem está logado; null é visitante (o catálogo é público, como na web). */
type Props = { userName: string | null; onSignIn: () => void; onSignedOut: () => void };

// Lista na tela e de onde ela veio. snapshot=true é o catálogo embutido, sem passar pelo servidor.
type Catalog = { items: Product[]; snapshot: boolean };
const SNAPSHOT: Catalog = { items: OFFLINE_PRODUCTS, snapshot: true };
const EMPTY: Catalog = { items: [], snapshot: false };

export function CatalogScreen({ userName, onSignIn, onSignedOut }: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY);
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
      setCatalog({ items: await loadProducts(), snapshot: false });
    } catch (err) {
      // Falha de carga não apaga o que já estava na tela. Sem rede e com a lista vazia, mostra o
      // catálogo embutido; erro do servidor (4xx/5xx) não é falta de rede e não troca nada.
      const status = err instanceof ApiError ? err.status : -1;
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o catálogo.');
      setCatalog((current) => (shouldUseSnapshot(status, current.items.length) ? SNAPSHOT : current));
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

  async function signOut(): Promise<void> {
    await logout();
    onSignedOut();
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: STATUS_BAR_INSET + 12 }]}>
        {userName ? <Text style={styles.greeting}>Olá, {userName.split(' ')[0]}</Text> : null}
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

      {loading && catalog.items.length === 0 ? (
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
            catalog.snapshot || error ? (
              <View style={styles.boxes}>
                {catalog.snapshot ? (
                  <Text accessibilityLiveRegion="polite" style={styles.notice}>
                    Modo offline: catálogo de {snapshotLabel(OFFLINE_CATALOG_DATE)}, pode estar desatualizado. Puxe a lista
                    para atualizar quando tiver conexão.
                  </Text>
                ) : null}
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable accessibilityRole="button" onPress={() => load(false)} style={styles.retry}>
                      <Text style={styles.retryText}>Tentar novamente</Text>
                    </Pressable>
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
        <Pressable accessibilityRole="button" onPress={userName !== null ? signOut : onSignIn} style={styles.tab}>
          <Text style={styles.tabText}>{userName !== null ? 'Sair' : 'Entrar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.paper, gap: 12 },
  greeting: { fontSize: 13, fontWeight: '600', color: colors.greenMuted },
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
  boxes: { gap: 12, marginBottom: 12 },
  notice: {
    backgroundColor: colors.noticeSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.control,
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.noticeText
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.control,
    padding: 14,
    gap: 10,
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
