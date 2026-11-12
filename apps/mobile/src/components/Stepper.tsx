import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TOUCH, radius } from '../theme.ts';

type Props = { value: number; onChange: (value: number) => void; min?: number; label: string };

// Quantidade com − e +, botões de 48 dp. O limite máximo é aplicado pelas regras do carrinho.
export function Stepper({ value, onChange, min = 1, label }: Props): React.JSX.Element {
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Diminuir ${label}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={[styles.button, value <= min && styles.disabled]}
      >
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Aumentar ${label}`}
        onPress={() => onChange(value + 1)}
        style={styles.button}
      >
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  disabled: { opacity: 0.4 },
  sign: { fontSize: 20, fontWeight: '800', color: colors.green },
  value: { minWidth: 36, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.greenDark }
});
