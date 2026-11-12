import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, iconSize, MIN_TOUCH, space } from '../theme.ts';
import { Icon } from './Icon.tsx';
import { Tap } from './Tap.tsx';

type Props = { title: string; onBack?: () => void; subtitle?: string };

// Topo das telas: abaixo da barra de status do aparelho, com "Voltar" quando a tela foi empilhada.
export function ScreenHeader({ title, onBack, subtitle }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      {onBack ? (
        <Tap accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={styles.back}>
          <Icon name="chevron-back" size={iconSize.md} color={colors.primary} />
          <Text style={styles.backText}>Voltar</Text>
        </Tap>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm, backgroundColor: colors.background },
  back: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2 },
  backText: { fontSize: fontSize.body, fontWeight: '700', color: colors.primary },
  title: { fontSize: fontSize.heading, fontWeight: '800', color: colors.foreground },
  subtitle: { fontSize: fontSize.small, color: colors.secondaryForeground, marginTop: 2 }
});
