import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { API_URL } from '../config.ts';
import { normalizeServerUrl } from '../lib/server.ts';
import { getApiBaseUrl } from '../services/api.ts';
import { checkServer } from '../services/server.ts';

type Props = {
  onBack: () => void;
  /** url null volta ao endereço do APK. O App confirma (fila pendente), limpa a sessão e recarrega. */
  onSave: (url: string | null) => void;
};

// Endereço do servidor: quando o PC muda de rede (outro IP), troca aqui em vez de gerar outro APK.
export function ServerScreen({ onBack, onSave }: Props): React.JSX.Element {
  const current = getApiBaseUrl();
  const [text, setText] = useState(current);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    const url = normalizeServerUrl(text);
    if (!url) return setError('Endereço inválido. Ex.: 192.168.1.34:3001');
    setChecking(true);
    setError(null);
    const ok = await checkServer(url);
    setChecking(false);
    if (!ok) return setError(`Não encontrei o AgroTech em ${url}. Confira o IP, a porta e se o celular está na mesma rede.`);
    onSave(url === API_URL ? null : url);
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Servidor" subtitle="Para onde o app manda as requisições" onBack={onBack} />
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <View style={ui.card}>
          <Text style={ui.muted}>Em uso agora:</Text>
          <Text selectable style={ui.text}>
            {current}
          </Text>
          <Text style={ui.muted}>Endereço do APK: {API_URL}</Text>
        </View>
        <View style={ui.card}>
          <Field
            label="ENDEREÇO (IP:PORTA)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="192.168.1.34:3001"
            value={text}
            onChangeText={setText}
            onSubmitEditing={save}
            returnKeyType="done"
          />
          <Text style={ui.notice}>Trocar de servidor encerra a sua sessão neste aparelho: entre de novo depois.</Text>
          {error ? <Text style={ui.error}>{error}</Text> : null}
          <Button title="Testar e salvar" onPress={save} loading={checking} />
          {current !== API_URL ? <Button title="Voltar ao endereço do APK" variant="outline" onPress={() => onSave(null)} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
