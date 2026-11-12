import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ui } from '../components/ui.ts';
import { validatePassword } from '../domain.ts';
import { ApiError } from '../services/api.ts';
import { resetPassword } from '../services/auth.ts';

type Props = { onDone: () => void };

// Esqueci minha senha: o código vem do suporte (o administrador gera e repassa). Não há envio por e-mail.
export function ResetForm({ onDone }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (loading) return;
    if (!email.trim() || !code.trim()) return setError('Informe o e-mail e o código que o suporte passou.');
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={ui.notice}>
        Peça um código de redefinição ao suporte (Conta → Suporte → Falar com atendente). O código vale 30 minutos e
        uma vez só.
      </Text>
      <Field
        label="E-MAIL"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field label="CÓDIGO" autoCapitalize="characters" autoCorrect={false} placeholder="Ex: K7P2X9QM" value={code} onChangeText={setCode} />
      <Field label="NOVA SENHA" secret autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={password} onChangeText={setPassword} />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Button title="Trocar senha" onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: 16 } });
