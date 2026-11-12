import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '../lib/catalog.ts';
import { colors, iconSize, radius } from '../theme.ts';
import { Icon } from './Icon.tsx';
import type { Product } from '../services/products.ts';

// Cartão da grade de 2 colunas, como o da web: bloco de cor (ou foto), nome, local, nota e preço.
export function ProductCard({ product }: { product: Product }): React.JSX.Element {
  const place = product.location ? product.location.split(' - ')[0] : null;
  // Foto que não carrega (sem rede, link quebrado) cai no emoji, como na web.
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <View style={styles.card} accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}>
      <View style={[styles.media, { backgroundColor: product.imageBg ?? colors.primarySoft }]}>
        {product.image && !photoFailed ? (
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" onError={() => setPhotoFailed(true)} />
        ) : (
          // Emoji aqui é ilustração do produto (vem do servidor, como na web), não ícone de controle.
          <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {product.imageEmoji ?? '📦'}
          </Text>
        )}
        {place ? (
          <View style={styles.place}>
            <Icon name="location-outline" size={iconSize.sm - 4} color={colors.onOverlay} />
            <Text style={styles.placeText} numberOfLines={1}>
              {place}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      {product.rating !== undefined ? (
        <View style={styles.ratingRow} accessibilityLabel={`Nota ${product.rating}`}>
          <Icon name="star" size={iconSize.sm - 2} color={colors.accent} />
          <Text style={styles.rating}>{product.rating}</Text>
        </View>
      ) : null}
      <Text style={styles.price}>{formatPrice(product.price)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  media: {
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border
  },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 38 },
  place: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.overlay,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  placeText: { color: colors.onOverlay, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  name: { marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.foreground, minHeight: 36 },
  rating: { fontSize: 12, color: colors.secondaryForeground },
  price: { marginTop: 4, fontSize: 15, fontWeight: '800', color: colors.primary }
});
