import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { Icon } from '../components/Icon.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { Stepper } from '../components/Stepper.tsx';
import { Tap } from '../components/Tap.tsx';
import { ui } from '../components/ui.ts';
import { MAX_ORDER_QUANTITY } from '../lib/cart.ts';
import { formatPrice } from '../lib/catalog.ts';
import { ApiError } from '../services/api.ts';
import { addReview, type Product, type Review } from '../services/products.ts';
import { colors, iconSize, MIN_TOUCH, radius } from '../theme.ts';

type Props = {
  product: Product;
  loggedIn: boolean;
  isFavorite: boolean;
  onBack: () => void;
  /** false quando não adicionou (ex.: vendedor diferente do carrinho, com o Mercado Pago ligado). */
  onAdd: (product: Product, quantity: number) => boolean;
  onGoToCart: () => void;
  onToggleFavorite: (product: Product) => void;
  onNeedLogin: () => void;
};

export function ProductDetailScreen(props: Props): React.JSX.Element {
  const { product, loggedIn, isFavorite, onBack, onAdd, onGoToCart, onToggleFavorite, onNeedLogin } = props;
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<number | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(product.comments ?? []);
  const [rating, setRating] = useState(product.rating);
  const [reviewText, setReviewText] = useState('');
  const [stars, setStars] = useState(5);
  const [sending, setSending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  function add(): void {
    if (onAdd(product, quantity)) setAdded(quantity);
  }

  async function sendReview(): Promise<void> {
    if (sending) return;
    if (!reviewText.trim()) return setReviewError('Escreva sua avaliação antes de enviar.');
    setSending(true);
    setReviewError(null);
    try {
      const result = await addReview(product.id, { text: reviewText.trim(), rating: stars });
      setReviews((current) => [result.review, ...current]);
      setRating(result.rating);
      setReviewText('');
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : 'Não foi possível enviar a avaliação.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Detalhes do produto" onBack={onBack} />
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.media, { backgroundColor: product.imageBg ?? colors.primarySoft }]}>
          {product.image && !photoFailed ? (
            <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" onError={() => setPhotoFailed(true)} />
          ) : (
            <Text style={styles.emoji}>{product.imageEmoji ?? '📦'}</Text>
          )}
        </View>

        <View style={ui.card}>
          <View style={ui.between}>
            {product.category ? <Text style={ui.muted}>{product.category}</Text> : <View />}
            <Tap
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Tirar dos favoritos' : 'Salvar nos favoritos'}
              accessibilityState={{ selected: isFavorite }}
              onPress={() => (loggedIn ? onToggleFavorite(product) : onNeedLogin())}
              style={styles.favorite}
            >
              <Icon name={isFavorite ? 'heart' : 'heart-outline'} size={iconSize.md} color={colors.destructive} />
              <Text style={styles.favoriteText}>{isFavorite ? 'Favorito' : 'Favoritar'}</Text>
            </Tap>
          </View>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            {formatPrice(product.price)}
            {product.unit ? <Text style={ui.muted}> / {product.unit}</Text> : null}
          </Text>
          {rating ? (
            <View style={ui.row} accessibilityLabel={`Nota ${rating}, ${reviews.length} avaliações`}>
              <Icon name="star" size={iconSize.sm} color={colors.accent} />
              <Text style={ui.muted}>
                {rating} · {reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'}
              </Text>
            </View>
          ) : null}
          {product.sellerName ? <Text style={ui.text}>Vendido por {product.sellerName}</Text> : null}
          {product.location ? <Text style={ui.muted}>{product.location}</Text> : null}
          {typeof product.stock === 'number' ? <Text style={ui.muted}>Estoque: {product.stock}</Text> : null}
          {product.description ? <Text style={[ui.text, styles.description]}>{product.description}</Text> : null}
        </View>

        <View style={ui.card}>
          <View style={ui.between}>
            <Text style={ui.label}>QUANTIDADE</Text>
            <Stepper
              label="quantidade"
              value={quantity}
              onChange={(value) => setQuantity(Math.min(MAX_ORDER_QUANTITY, Math.max(1, value)))}
            />
          </View>
          <Text style={ui.muted}>Subtotal: {formatPrice(product.price * quantity)}</Text>
          <Button title="Adicionar ao carrinho" onPress={add} />
          {added !== null ? (
            <>
              <Text accessibilityLiveRegion="polite" style={ui.success}>
                {added} {added === 1 ? 'unidade adicionada' : 'unidades adicionadas'} ao carrinho.
              </Text>
              <Button title="Ver carrinho" variant="outline" onPress={onGoToCart} />
            </>
          ) : null}
        </View>

        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Avaliações</Text>
          {reviews.length === 0 ? (
            <Text style={ui.muted}>
              {product.comments === undefined ? 'Avaliações aparecem com internet.' : 'Ainda não há avaliações.'}
            </Text>
          ) : null}
          {reviews.map((review) => (
            <View key={review.id} style={styles.review}>
              <View style={ui.row} accessibilityLabel={`${review.author ?? 'Produtor'}, nota ${review.rating}`}>
                <Text style={styles.reviewAuthor}>{review.author ?? 'Produtor'}</Text>
                <Icon name="star" size={iconSize.sm - 2} color={colors.accent} />
                <Text style={ui.muted}>{review.rating}</Text>
              </View>
              <Text style={ui.text}>{review.text}</Text>
            </View>
          ))}

          {loggedIn ? (
            <>
              <Text style={ui.label}>SUA NOTA</Text>
              <View style={ui.row} accessibilityRole="radiogroup">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Tap
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                    accessibilityState={{ checked: value === stars, selected: value === stars }}
                    onPress={() => setStars(value)}
                    style={styles.star}
                  >
                    <Icon name={value <= stars ? 'star' : 'star-outline'} size={iconSize.md} color={colors.accent} />
                  </Tap>
                ))}
              </View>
              <Field
                label="SUA AVALIAÇÃO"
                multiline
                placeholder="Como foi a qualidade, a entrega..."
                value={reviewText}
                onChangeText={setReviewText}
                style={styles.reviewInput}
              />
              {reviewError ? <Text style={ui.error}>{reviewError}</Text> : null}
              <Button title="Publicar avaliação" onPress={sendReview} loading={sending} />
            </>
          ) : (
            <Button title="Entrar para avaliar" variant="outline" onPress={onNeedLogin} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  media: { height: 180, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 72 },
  name: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  price: { fontSize: 22, fontWeight: '800', color: colors.primary },
  description: { marginTop: 4, lineHeight: 20 },
  favorite: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  favoriteText: { fontSize: 13, fontWeight: '700', color: colors.destructive },
  review: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 4 },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  star: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  reviewInput: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }
});
