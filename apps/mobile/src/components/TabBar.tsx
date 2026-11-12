import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tab } from '../lib/navigation.ts';
import { colors, fontSize, iconSize, MIN_TOUCH, space } from '../theme.ts';
import { Icon, type IconName } from './Icon.tsx';
import { Tap } from './Tap.tsx';

const TABS: { tab: Tab; icon: IconName; label: string }[] = [
  { tab: 'catalog', icon: 'leaf-outline', label: 'Catálogo' },
  { tab: 'cart', icon: 'cart-outline', label: 'Carrinho' },
  { tab: 'sell', icon: 'pricetag-outline', label: 'Vender' },
  { tab: 'finance', icon: 'wallet-outline', label: 'Financeiro' },
  { tab: 'account', icon: 'person-outline', label: 'Conta' }
];

type Props = { active: Tab; cartCount: number; onSelect: (tab: Tab) => void };

// Barra de abas fixa embaixo, acima dos botões/gestos do Android (margem real do aparelho).
// A aba ativa muda cor, peso do texto e ganha um traço em cima: não depende só da cor.
export function TabBar({ active, cartCount, onSelect }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + space.xs }]} accessibilityRole="tablist">
      {TABS.map((item) => {
        const selected = item.tab === active;
        const count = item.tab === 'cart' && cartCount > 0 ? cartCount : 0;
        const color = selected ? colors.primary : colors.mutedForeground;
        return (
          <Tap
            key={item.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={count ? `${item.label}, ${count} ${count === 1 ? 'item' : 'itens'}` : item.label}
            onPress={() => onSelect(item.tab)}
            style={styles.tab}
          >
            <View style={[styles.indicator, selected && styles.indicatorActive]} />
            <View>
              <Icon name={item.icon} size={iconSize.md} color={color} />
              {count ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }, selected && styles.labelSelected]} numberOfLines={1}>
              {item.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: MIN_TOUCH + space.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  indicator: { position: 'absolute', top: 0, height: 3, width: 32, borderRadius: 2 },
  indicatorActive: { backgroundColor: colors.primary },
  label: { fontSize: fontSize.caption, fontWeight: '600' },
  labelSelected: { fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: space.xs,
    borderRadius: 9,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: { color: colors.onPrimary, fontSize: fontSize.caption, fontWeight: '800' }
});
