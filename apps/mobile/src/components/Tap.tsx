import React from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, PRESSED_OPACITY } from '../theme.ts';

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

// Toque com retorno visual em todo o app (skill ui-ux-pro-max: "tap feedback"): ripple no Android e
// opacidade ao pressionar. Não muda tamanho nem posição, então nada pula na tela.
export function Tap({ style, android_ripple, ...props }: Props): React.JSX.Element {
  return (
    <Pressable
      android_ripple={android_ripple ?? { color: colors.ripple }}
      style={({ pressed }) => [style, pressed && styles.pressed]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({ pressed: { opacity: PRESSED_OPACITY } });
