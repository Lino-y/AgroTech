import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, iconSize, MIN_TOUCH, radius, space } from '../theme.ts';
import { Icon } from './Icon.tsx';
import { Tap } from './Tap.tsx';

type Props = { value: number; onChange: (value: number) => void; min?: number; label: string };

// Quantidade com − e +, botões de 48 dp. O limite máximo é aplicado pelas regras do carrinho.
export function Stepper({ value, onChange, min = 1, label }: Props): React.JSX.Element {
  const atMin = value <= min;
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Diminuir ${label}`}
        accessibilityState={{ disabled: atMin }}
        disabled={atMin}
        onPress={() => onChange(value - 1)}
        style={[styles.button, atMin && styles.disabled]}
      >
        <Icon name="remove" size={iconSize.md} color={colors.primary} />
      </Tap>
      <Text style={styles.value}>{value}</Text>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Aumentar ${label}`}
        onPress={() => onChange(value + 1)}
        style={styles.button}
      >
        <Icon name="add" size={iconSize.md} color={colors.primary} />
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  disabled: { opacity: 0.4 },
  value: { minWidth: 36, textAlign: 'center', fontSize: fontSize.lead, fontWeight: '800', color: colors.foreground }
});
