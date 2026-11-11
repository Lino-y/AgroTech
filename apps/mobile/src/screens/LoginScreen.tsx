import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../services/api.ts';
import { login } from '../services/auth.ts';

type Props = { onLoggedIn: () => void };

export function LoginScreen({ onLoggedIn }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (loading) return;
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
    <View style={styles.container}>
      <Text style={styles.title}>AgroTech</Text>
      <TextInput
        accessibilityLabel="E-mail"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="E-mail"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        accessibilityLabel="Senha"
        autoCapitalize="none"
        placeholder="Senha"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={submit}
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonBusy]}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F4FBF7' },
  title: { fontSize: 28, fontWeight: '700', color: '#1B5E20', marginBottom: 24, textAlign: 'center' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16
  },
  error: { color: '#B71C1C', marginBottom: 12, textAlign: 'center' },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
