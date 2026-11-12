import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '../lib/catalog.ts';
import { colors, radius } from '../theme.ts';
import type { Product } from '../services/products.ts';

// Cartão da grade de 2 colunas, como o da web: bloco de cor (ou foto), nome, local, nota e preço.
export function ProductCard({ product }: { product: Product }): React.JSX.Element {
  const place = product.location ? product.location.split(' - ')[0] : null;
  // Foto que não carrega (sem rede, link quebrado) cai no emoji, como na web.
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <View style={styles.card} accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}>
      <View style={[styles.media, { backgroundColor: product.imageBg ?? colors.greenSoft }]}>
        {product.image && !photoFailed ? (
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" onError={() => setPhotoFailed(true)} />
        ) : (
          <Text style={styles.emoji}>{product.imageEmoji ?? '📦'}</Text>
        )}
        {place ? (
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      {product.rating !== undefined ? <Text style={styles.rating}>★ {product.rating}</Text> : null}
      <Text style={styles.price}>{formatPrice(product.price)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,230,201,0.8)'
  },
  media: {
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,230,201,0.5)'
  },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 38 },
  place: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    maxWidth: '90%',
    backgroundColor: 'rgba(22,61,39,0.82)',
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden'
  },
  name: { marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.greenDark, minHeight: 36 },
  rating: { marginTop: 2, fontSize: 12, color: colors.greenMuted },
  price: { marginTop: 4, fontSize: 15, fontWeight: '800', color: colors.green }
});
