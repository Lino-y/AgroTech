import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { ui } from '../components/ui.ts';
import { APP_VERSION } from '../config.ts';
import { colors, iconSize } from '../theme.ts';

type Props = { minVersion: string; onRetry: () => void; onDownload?: () => void };

// A API respondeu 426: esta versão do app está abaixo da mínima (APP_MIN_VERSION no servidor).
export function UpdateScreen({ minVersion, onRetry, onDownload }: Props): React.JSX.Element {
  return (
    <View style={ui.screen}>
      <View style={ui.center}>
        <Icon name="cloud-download-outline" size={iconSize.xl} color={colors.primary} />
        <Text style={ui.sectionTitle} accessibilityRole="header">
          Atualize o app
        </Text>
        <Text style={[ui.text, { textAlign: 'center' }]}>
          Esta versão ({APP_VERSION}) não é mais aceita pelo servidor{minVersion ? `; a mínima é ${minVersion}` : ''}. Instale o
          APK novo para continuar.
        </Text>
        {onDownload ? <Button title="Baixar versão nova" onPress={onDownload} /> : null}
        <Button title="Tentar de novo" variant="outline" onPress={onRetry} />
      </View>
    </View>
  );
}
