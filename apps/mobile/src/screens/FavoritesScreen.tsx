import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ProductCard } from '../components/ProductCard.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { Tap } from '../components/Tap.tsx';
import { ui } from '../components/ui.ts';
import type { Product } from '../services/products.ts';

type Props = { favorites: Product[]; onBack: () => void; onOpenProduct: (product: Product) => void; onBrowse: () => void };

// Favoritos da conta, guardados no aparelho (abrem mesmo sem internet).
export function FavoritesScreen({ favorites, onBack, onOpenProduct, onBrowse }: Props): React.JSX.Element {
  return (
    <View style={ui.screen}>
      <ScreenHeader title="Meus favoritos" onBack={onBack} />
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={ui.scroll}
        renderItem={({ item }) => (
          <Tap accessibilityRole="button" accessibilityHint="Abre os detalhes" onPress={() => onOpenProduct(item)} style={styles.cell}>
            <ProductCard product={item} />
          </Tap>
        )}
        ListEmptyComponent={
          <View style={ui.center}>
            <Text style={ui.sectionTitle}>Nenhum favorito ainda</Text>
            <Text style={ui.muted}>Toque em "Favoritar" no detalhe de um produto.</Text>
            <Button title="Ver catálogo" variant="outline" onPress={onBrowse} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  cell: { flex: 1 }
});
