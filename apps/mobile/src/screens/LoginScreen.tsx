import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import app from '../../app.json';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ApiError } from '../services/api.ts';
import { login } from '../services/auth.ts';
import { colors, radius, STATUS_BAR_INSET } from '../theme.ts';

type Props = { onLoggedIn: () => void; onRegister: () => void; onOffline: () => void };

export function LoginScreen({ onLoggedIn, onRegister, onOffline }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  async function submit(): Promise<void> {
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Informe o e-mail e a senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onLoggedIn();
    } catch (err) {
      if (err instanceof ApiError) {
        // Sem rede, o caminho que resolve é o modo offline: avisa na própria mensagem.
        setError(err.status === 0 ? `${err.message} Ou toque em "Continuar offline".` : err.message);
      } else {
        setError('Não foi possível entrar. Tente de novo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: STATUS_BAR_INSET + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>AgroTech</Text>
        <Text style={styles.subtitle}>Entre para ver o catálogo de insumos</Text>

        <View style={styles.form}>
          <Field
            label="E-MAIL"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="seuemail@fazenda.com"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="SENHA"
            secret
            inputRef={passwordRef}
            autoCapitalize="none"
            autoComplete="password"
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={submit}
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button title="Entrar" onPress={submit} loading={loading} />
        </View>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.alternatives}>
          <Button title="Criar conta" variant="outline" onPress={onRegister} />
          <Button title="Continuar offline" variant="outline" onPress={onOffline} />
          <Text style={styles.hint}>Offline: veja o catálogo sem conta e sem internet.</Text>
        </View>

        <Text style={styles.version}>AgroTech v{app.expo.version} · versão de teste</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  brand: { fontSize: 30, fontWeight: '800', color: colors.greenDark, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.greenMuted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  form: { gap: 16 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.textMuted },
  alternatives: { gap: 12 },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  version: { marginTop: 32, fontSize: 12, color: colors.textMuted, textAlign: 'center' }
});
