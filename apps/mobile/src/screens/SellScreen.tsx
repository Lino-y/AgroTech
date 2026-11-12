import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Tap } from '../components/Tap.tsx';
import { Icon } from '../components/Icon.tsx';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { CATEGORY_STYLES, draftFromPrompt } from '../domain.ts';
import { formatPrice } from '../lib/catalog.ts';
import type { OutboxItem } from '../lib/outbox.ts';
import { draftToForm, parsePriceBR, photoDataUrl, validateProduct } from '../lib/sell.ts';
import { ApiError } from '../services/api.ts';
import { newIdempotencyKey } from '../services/orders.ts';
import { discardOutboxItem, enqueueListing, flushOutbox, readOutbox } from '../services/outbox.ts';
import { createProduct, deleteProduct, loadProducts, type NewProduct, type Product } from '../services/products.ts';
import { colors, iconSize, MIN_TOUCH, radius } from '../theme.ts';

// Categorias do domínio compartilhado: o servidor escolhe emoji e cor por elas (getProductCategoryStyle).
const CATEGORIES = Object.keys(CATEGORY_STYLES);

const EMPTY_FORM = { name: '', price: '', category: '', description: '', unit: 'unidade', stock: '100', location: '' };

type Props = { email: string; userId: string };

// Vender: anunciar (POST /api/products), "Minha Loja" (com excluir), a "IA" que preenche o formulário
// pelo texto livre (packages/domain/listing.js) e a fila offline: sem rede, o anúncio fica guardado
// e é enviado depois, com a mesma Idempotency-Key (nunca duplica).
export function SellScreen({ email, userId }: Props): React.JSX.Element {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mine, setMine] = useState<Product[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Mesma chave nas tentativas do mesmo anúncio (toque duplo); nova quando o formulário muda.
  const keyRef = useRef(newIdempotencyKey());

  useEffect(() => {
    keyRef.current = newIdempotencyKey();
  }, [form]);

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

  const sendQueue = useCallback(async () => {
    setFlushing(true);
    try {
      const result = await flushOutbox(userId);
      if (result.sent > 0) setSuccess(`${result.sent} ${result.sent === 1 ? 'anúncio guardado foi publicado' : 'anúncios guardados foram publicados'}.`);
      setQueue(await readOutbox(userId));
    } finally {
      setFlushing(false);
    }
    await loadMine();
  }, [userId, loadMine]);

  useEffect(() => {
    void sendQueue();
  }, [sendQueue]);

  function fillWithAi(): void {
    if (aiText.trim().length < 5) return setAiMessage('Descreva o que você quer anunciar para a IA preencher.');
    const filled = draftToForm(draftFromPrompt(aiText), CATEGORIES);
    setForm((current) => ({ ...current, ...filled }));
    const found = [filled.price && 'preço', filled.category && 'categoria', filled.stock && 'estoque', filled.unit && 'unidade', filled.location && 'local'].filter(Boolean);
    setAiMessage(found.length ? `IA preencheu: título, descrição, ${found.join(', ')}. Confira antes de publicar.` : 'IA preencheu título e descrição; complete os demais campos.');
  }

  // Foto só da galeria (o APK não pede câmera): reduzida para 1280 px de largura e JPEG, e conferida
  // contra o limite da web (1,4 MB) antes de ir no anúncio.
  async function pickPhoto(): Promise<void> {
    setPhotoError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > 1280) context.resize({ width: 1280 });
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
      const url = photoDataUrl(saved.base64 ?? '');
      if (url) setPhoto(url);
      else setPhotoError('A foto ficou grande demais (limite de 1,4 MB). Escolha outra.');
    } catch {
      setPhotoError('Não foi possível usar essa foto. Escolha outra.');
    }
  }

  async function discard(item: OutboxItem): Promise<void> {
    await discardOutboxItem(userId, item.key);
    setQueue(await readOutbox(userId));
  }

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
    const payload: NewProduct = {
      name: form.name.trim(),
      price: parsePriceBR(form.price),
      category: form.category,
      description: form.description.trim(),
      unit: form.unit.trim() || 'unidade',
      stock: Number(form.stock.trim()),
      location: form.location.trim() || 'Região Agrícola - BR',
      ...(photo ? { imageUrl: photo } : {})
    };
    try {
      const product = await createProduct(payload, keyRef.current);
      setForm(EMPTY_FORM);
      setPhoto(null);
      setSuccess(`"${product.name}" publicado no catálogo.`);
      await loadMine();
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        // Sem rede: guarda na fila desta conta e envia quando houver internet. A foto não vai na fila
        // (o armazenamento local é pequeno): só o texto.
        const textOnly = { ...payload };
        delete textOnly.imageUrl;
        await enqueueListing(textOnly, userId);
        setForm(EMPTY_FORM);
        setSuccess(
          photo
            ? 'Sem conexão: o anúncio (sem a foto) ficou guardado e será publicado quando houver internet.'
            : 'Sem conexão: o anúncio ficou guardado no aparelho e será publicado quando houver internet.'
        );
        setPhoto(null);
        setQueue(await readOutbox(userId));
        return;
      }
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
        {queue.length > 0 ? (
          <View style={ui.card}>
            <View style={ui.row}>
              <Icon name="cloud-upload-outline" size={iconSize.md} color={colors.warningForeground} />
              <Text style={ui.sectionTitle}>Aguardando internet</Text>
            </View>
            {queue.map((item) => (
              <View key={item.key} style={styles.queueItem}>
                <View style={styles.itemInfo}>
                  <Text style={ui.text} numberOfLines={1}>
                    {item.payload.name}
                  </Text>
                  <Text style={item.status === 'failed' ? styles.failed : ui.muted}>
                    {item.status === 'failed' ? `Recusado: ${item.error ?? 'erro'}` : `Guardado · ${item.attempts} tentativa(s)`}
                  </Text>
                </View>
                {item.status === 'failed' ? (
                  <Tap accessibilityRole="button" accessibilityLabel={`Descartar ${item.payload.name}`} onPress={() => discard(item)} style={styles.delete}>
                    <Text style={styles.deleteText}>Descartar</Text>
                  </Tap>
                ) : null}
              </View>
            ))}
            <Button title="Enviar agora" variant="outline" onPress={sendQueue} loading={flushing} />
          </View>
        ) : null}

        <View style={ui.card}>
          <View style={ui.row}>
            <Icon name="sparkles-outline" size={iconSize.md} color={colors.primary} />
            <Text style={ui.sectionTitle}>Preencher com IA</Text>
          </View>
          <Field
            label="DESCREVA O QUE QUER VENDER"
            multiline
            placeholder="Ex: Tenho 5000 kg de milho híbrido, R$ 120 o kg, retirada em Rio Verde - GO. Crie descrição técnica."
            value={aiText}
            onChangeText={setAiText}
            style={styles.description}
          />
          <Button title="Preencher o anúncio" variant="outline" onPress={fillWithAi} />
          {aiMessage ? <Text style={ui.success}>{aiMessage}</Text> : null}
        </View>

        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Novo anúncio</Text>
          <Field label="NOME DO PRODUTO" placeholder="Ex: Semente de milho híbrido 20 kg" value={form.name} onChangeText={set('name')} />
          <Field label="PREÇO (R$)" keyboardType="decimal-pad" placeholder="Ex: 450,00" value={form.price} onChangeText={set('price')} />
          <Text style={ui.label}>CATEGORIA</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((category) => {
              const selected = form.category === category;
              return (
                <Tap
                  key={category}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  onPress={() => set('category')(category)}
                  style={[ui.chip, selected && ui.chipSelected]}
                >
                  <Text style={[ui.chipText, selected && ui.chipTextSelected]}>
                    {CATEGORY_STYLES[category as keyof typeof CATEGORY_STYLES].emoji} {category}
                  </Text>
                </Tap>
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
          <Text style={ui.label}>FOTO (OPCIONAL)</Text>
          {photo ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel="Foto escolhida para o anúncio" />
              <View style={styles.photoActions}>
                <Button title="Trocar foto" variant="outline" onPress={pickPhoto} />
                <Button title="Remover foto" variant="outline" onPress={() => setPhoto(null)} />
              </View>
            </View>
          ) : (
            <Button title="Escolher foto da galeria" variant="outline" onPress={pickPhoto} />
          )}
          {photoError ? <Text style={ui.error}>{photoError}</Text> : null}
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
              <View style={[styles.thumb, { backgroundColor: product.imageBg ?? colors.primarySoft }]}>
                <Text style={styles.thumbEmoji}>{product.imageEmoji ?? '📦'}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={ui.text} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.itemPrice}>{formatPrice(product.price)}</Text>
              </View>
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`Excluir ${product.name}`}
                onPress={() => confirmDelete(product)}
                style={styles.delete}
              >
                <Icon name="trash-outline" size={iconSize.sm} color={colors.destructive} />
                <Text style={styles.deleteText}>Excluir</Text>
              </Tap>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  thumb: { width: 48, height: 48, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 24 },
  itemInfo: { flex: 1 },
  itemPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
  delete: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  photoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  photo: { width: 120, height: 90, borderRadius: radius.field },
  photoActions: { flex: 1, gap: 8 },
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  failed: { fontSize: 13, color: colors.destructive },
  deleteText: { fontSize: 14, fontWeight: '700', color: colors.destructive }
});
