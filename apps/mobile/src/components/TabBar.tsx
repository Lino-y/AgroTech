import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tab } from '../lib/navigation.ts';
import { colors, MIN_TOUCH } from '../theme.ts';

const TABS: { tab: Tab; icon: string; label: string }[] = [
  { tab: 'catalog', icon: '🌾', label: 'Catálogo' },
  { tab: 'cart', icon: '🛒', label: 'Carrinho' },
  { tab: 'sell', icon: '🏷️', label: 'Vender' },
  { tab: 'finance', icon: '💰', label: 'Financeiro' },
  { tab: 'account', icon: '👤', label: 'Conta' }
];

type Props = { active: Tab; cartCount: number; onSelect: (tab: Tab) => void };

// Barra de abas fixa embaixo, sempre acima dos botões/gestos do Android (margem real do aparelho).
export function TabBar({ active, cartCount, onSelect }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 4 }]} accessibilityRole="tablist">
      {TABS.map((item) => {
        const selected = item.tab === active;
        const badge = item.tab === 'cart' && cartCount > 0 ? ` (${cartCount})` : '';
        return (
          <Pressable
            key={item.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.label}${badge}`}
            onPress={() => onSelect(item.tab)}
            style={styles.tab}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {item.label}
              {badge}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4
  },
  tab: { flex: 1, minHeight: MIN_TOUCH + 6, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { fontSize: 18 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  labelSelected: { color: colors.greenDark, fontWeight: '800' }
});
