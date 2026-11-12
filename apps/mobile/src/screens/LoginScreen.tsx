import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { ApiError } from '../services/api.ts';
import { login } from '../services/auth.ts';
import { colors, MIN_TOUCH, radius } from '../theme.ts';

type Props = { onLoggedIn: () => void };

const TOP_INSET = (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 44) + 24;

export function LoginScreen({ onLoggedIn }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: TOP_INSET }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>AgroTech</Text>
        <Text style={styles.subtitle}>Entre para ver o catálogo de insumos</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              accessibilityLabel="E-mail"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="seuemail@fazenda.com"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>SENHA</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                accessibilityLabel="Senha"
                autoCapitalize="none"
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                returnKeyType="go"
                secureTextEntry={!showPassword}
                onSubmitEditing={submit}
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onPress={() => setShowPassword((value) => !value)}
                style={styles.toggle}
              >
                <Text style={styles.toggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
            </View>
          </View>

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            onPress={submit}
            style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonBusy]}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Entrar</Text>}
          </Pressable>
        </View>
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
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.greenDark, letterSpacing: 0.3 },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    fontSize: 15,
    color: colors.greenDark
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  toggle: {
    position: 'absolute',
    right: 0,
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: 12,
    justifyContent: 'center'
  },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.green },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  },
  button: {
    minHeight: 52,
    borderRadius: radius.control,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' }
});
