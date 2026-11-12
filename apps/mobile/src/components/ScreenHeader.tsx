import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, MIN_TOUCH } from '../theme.ts';

type Props = { title: string; onBack?: () => void; subtitle?: string };

// Topo das telas: abaixo da barra de status do aparelho, com "Voltar" quando a tela foi empilhada.
export function ScreenHeader({ title, onBack, subtitle }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Voltar</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.paper },
  back: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '700', color: colors.green },
  title: { fontSize: 20, fontWeight: '800', color: colors.greenDark },
  subtitle: { fontSize: 13, color: colors.greenMuted, marginTop: 2 }
});
