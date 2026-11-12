import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ApiError } from '../services/api.ts';
import { login, type User } from '../services/auth.ts';
import { colors, radius } from '../theme.ts';

type Props = { onLoggedIn: (user: User) => void };

export function LoginForm({ onLoggedIn }: Props): React.JSX.Element {
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
      onLoggedIn(await login(email.trim(), password));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.');
    } finally {
      setLoading(false);
    }
  }

  return (
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
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  error: {
    color: colors.destructive,
    backgroundColor: colors.destructiveSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  }
});
