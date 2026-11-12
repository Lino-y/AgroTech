import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSize } from '../theme.ts';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = { name: IconName; size?: number; color?: string };

// Ícones vetoriais de uma família só (Ionicons, estilo contorno), no lugar de emoji, como pede a
// skill ui-ux-pro-max. Sempre ao lado de um texto visível: por isso fica fora da leitura de tela.
// Importa só o Ionicons para não levar as fontes de todas as famílias para o APK.
export function Icon({ name, size = iconSize.md, color = colors.foreground }: Props): React.JSX.Element {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
