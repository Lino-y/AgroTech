import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Tap } from '../components/Tap.tsx';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { SIGNUP_ROLES, validateRegister, type SignupRole } from '../lib/forms.ts';
import { ApiError } from '../services/api.ts';
import { register, type User } from '../services/auth.ts';
import { colors, MIN_TOUCH, radius } from '../theme.ts';

type Props = { onRegistered: (user: User) => void };
type InputRef = React.RefObject<React.ComponentRef<typeof TextInput> | null>;

export function RegisterForm({ onRegistered }: Props): React.JSX.Element {
  const [role, setRole] = useState<SignupRole>('PRODUTOR');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef: InputRef = useRef(null);
  const companyRef: InputRef = useRef(null);
  const passwordRef: InputRef = useRef(null);

  async function submit(): Promise<void> {
    if (loading) return;
    const problem = validateRegister({ name, email, password });
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      onRegistered(
        await register({ name: name.trim(), email: email.trim(), password, role, propertyOrCompany: company.trim() })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta. Tente de novo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.roles} accessibilityRole="radiogroup">
        <Text style={styles.label}>PERFIL</Text>
        {SIGNUP_ROLES.map((item) => {
          const selected = role === item.value;
          return (
            <Tap
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              onPress={() => setRole(item.value)}
              style={[styles.role, selected && styles.roleSelected]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]} />
              <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{item.label}</Text>
            </Tap>
          );
        })}
      </View>

      <Field
        label="NOME COMPLETO"
        autoComplete="name"
        placeholder="Ex: João Silva"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        value={name}
        onChangeText={setName}
      />
      <Field
        label="E-MAIL"
        inputRef={emailRef}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="seuemail@fazenda.com"
        returnKeyType="next"
        onSubmitEditing={() => companyRef.current?.focus()}
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="PROPRIEDADE OU EMPRESA (OPCIONAL)"
        inputRef={companyRef}
        placeholder="Ex: Fazenda Boa Vista"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        value={company}
        onChangeText={setCompany}
      />
      <Field
        label="SENHA"
        secret
        inputRef={passwordRef}
        autoCapitalize="none"
        autoComplete="new-password"
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

      <Button title="Criar conta" onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground, letterSpacing: 0.3 },
  roles: { gap: 8 },
  role: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface
  },
  roleSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleText: { fontSize: 15, color: colors.foreground },
  roleTextSelected: { fontWeight: '700' },
  error: {
    color: colors.destructive,
    backgroundColor: colors.destructiveSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  }
});
