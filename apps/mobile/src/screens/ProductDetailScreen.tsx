import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { Stepper } from '../components/Stepper.tsx';
import { ui } from '../components/ui.ts';
import { MAX_ORDER_QUANTITY } from '../lib/cart.ts';
import { formatPrice } from '../lib/catalog.ts';
import type { Product } from '../services/products.ts';
import { colors, radius } from '../theme.ts';

type Props = {
  product: Product;
  onBack: () => void;
  onAdd: (product: Product, quantity: number) => void;
  onGoToCart: () => void;
};

export function ProductDetailScreen({ product, onBack, onAdd, onGoToCart }: Props): React.JSX.Element {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<number | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  function add(): void {
    onAdd(product, quantity);
    setAdded(quantity);
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Detalhes do produto" onBack={onBack} />
      <ScrollView contentContainerStyle={ui.scroll}>
        <View style={[styles.media, { backgroundColor: product.imageBg ?? colors.greenSoft }]}>
          {product.image && !photoFailed ? (
            <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" onError={() => setPhotoFailed(true)} />
          ) : (
            <Text style={styles.emoji}>{product.imageEmoji ?? '📦'}</Text>
          )}
        </View>

        <View style={ui.card}>
          {product.category ? <Text style={ui.muted}>{product.category}</Text> : null}
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            {formatPrice(product.price)}
            {product.unit ? <Text style={ui.muted}> / {product.unit}</Text> : null}
          </Text>
          {product.rating ? <Text style={ui.muted}>★ {product.rating}</Text> : null}
          {product.sellerName ? <Text style={ui.text}>Vendido por {product.sellerName}</Text> : null}
          {product.location ? <Text style={ui.muted}>{product.location}</Text> : null}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  media: { height: 180, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 72 },
  name: { fontSize: 20, fontWeight: '800', color: colors.greenDark },
  price: { fontSize: 22, fontWeight: '800', color: colors.green },
  description: { marginTop: 4, lineHeight: 20 }
});
