import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { CATEGORY_STYLES } from '../domain.ts';
import { formatPrice } from '../lib/catalog.ts';
import { parsePriceBR, validateProduct } from '../lib/sell.ts';
import { ApiError } from '../services/api.ts';
import { createProduct, deleteProduct, loadProducts, type Product } from '../services/products.ts';
import { colors, MIN_TOUCH, radius } from '../theme.ts';

// Categorias do domínio compartilhado: o servidor escolhe emoji e cor por elas (getProductCategoryStyle).
const CATEGORIES = Object.keys(CATEGORY_STYLES);

const EMPTY_FORM = { name: '', price: '', category: '', description: '', unit: 'unidade', stock: '100', location: '' };

type Props = { email: string };

// Vender: anunciar (POST /api/products) e "Minha Loja", os anúncios da conta (com excluir).
export function SellScreen({ email }: Props): React.JSX.Element {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mine, setMine] = useState<Product[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const loadMine = useCallback(async () => {
    setListError(null);
    try {
      const all = await loadProducts();
      setMine(all.filter((product) => product.ownerEmail === email));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Erro ao carregar seus anúncios.');
    }
  }, [email]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  async function publish(): Promise<void> {
    if (sending) return;
    const problem = validateProduct(form);
    if (problem) {
      setError(problem);
      setSuccess(null);
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const product = await createProduct({
        name: form.name.trim(),
        price: parsePriceBR(form.price),
        category: form.category,
        description: form.description.trim(),
        unit: form.unit.trim() || 'unidade',
        stock: Number(form.stock.trim()),
        location: form.location.trim() || 'Região Agrícola - BR'
      });
      setForm(EMPTY_FORM);
      setSuccess(`"${product.name}" publicado no catálogo.`);
      await loadMine();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar. Tente de novo.');
    } finally {
      setSending(false);
    }
  }

  function confirmDelete(product: Product): void {
    Alert.alert('Excluir anúncio', `Excluir "${product.name}" do catálogo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(product.id);
            await loadMine();
          } catch (err) {
            setListError(err instanceof ApiError ? err.message : 'Não foi possível excluir.');
          }
        }
      }
    ]);
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Vender" subtitle="Anuncie lotes, insumos e máquinas" />
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Novo anúncio</Text>
          <Field label="NOME DO PRODUTO" placeholder="Ex: Semente de milho híbrido 20 kg" value={form.name} onChangeText={set('name')} />
          <Field label="PREÇO (R$)" keyboardType="decimal-pad" placeholder="Ex: 450,00" value={form.price} onChangeText={set('price')} />
          <Text style={ui.label}>CATEGORIA</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((category) => {
              const selected = form.category === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  onPress={() => set('category')(category)}
                  style={[ui.chip, selected && ui.chipSelected]}
                >
                  <Text style={[ui.chipText, selected && ui.chipTextSelected]}>
                    {CATEGORY_STYLES[category as keyof typeof CATEGORY_STYLES].emoji} {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Field label="UNIDADE" placeholder="Ex: saco 20 kg, tonelada, diária" value={form.unit} onChangeText={set('unit')} />
          <Field label="ESTOQUE" keyboardType="number-pad" value={form.stock} onChangeText={set('stock')} />
          <Field label="LOCAL (OPCIONAL)" placeholder="Ex: Sorriso - MT" value={form.location} onChangeText={set('location')} />
          <Field
            label="DESCRIÇÃO"
            placeholder="Qualidade, safra, condições de entrega..."
            multiline
            numberOfLines={4}
            style={styles.description}
            value={form.description}
            onChangeText={set('description')}
          />
          {error ? <Text style={ui.error}>{error}</Text> : null}
          {success ? (
            <Text accessibilityLiveRegion="polite" style={ui.success}>
              {success}
            </Text>
          ) : null}
          <Button title="Publicar anúncio" onPress={publish} loading={sending} />
        </View>

        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Minha loja</Text>
          {listError ? <Text style={ui.error}>{listError}</Text> : null}
          {mine.length === 0 && !listError ? <Text style={ui.muted}>Você ainda não tem anúncios.</Text> : null}
          {mine.map((product) => (
            <View key={product.id} style={styles.item}>
              <View style={[styles.thumb, { backgroundColor: product.imageBg ?? colors.greenSoft }]}>
                <Text style={styles.thumbEmoji}>{product.imageEmoji ?? '📦'}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={ui.text} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.itemPrice}>{formatPrice(product.price)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Excluir ${product.name}`}
                onPress={() => confirmDelete(product)}
                style={styles.delete}
              >
                <Text style={styles.deleteText}>Excluir</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  description: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  thumb: { width: 48, height: 48, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 24 },
  itemInfo: { flex: 1 },
  itemPrice: { fontSize: 14, fontWeight: '800', color: colors.green },
  delete: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 8 },
  deleteText: { fontSize: 14, fontWeight: '700', color: colors.danger }
});
