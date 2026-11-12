import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { SIGNUP_ROLES, validateRegister, type SignupRole } from '../lib/forms.ts';
import { ApiError } from '../services/api.ts';
import { register } from '../services/auth.ts';
import { colors, MIN_TOUCH, radius, STATUS_BAR_INSET } from '../theme.ts';

type Props = { onRegistered: () => void; onBack: () => void };
type InputRef = React.RefObject<React.ComponentRef<typeof TextInput> | null>;

export function RegisterScreen({ onRegistered, onBack }: Props): React.JSX.Element {
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
      await register({ name: name.trim(), email: email.trim(), password, role, propertyOrCompany: company.trim() });
      onRegistered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta. Tente de novo.');
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
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>Escolha o seu perfil e preencha os dados</Text>

        <View style={styles.form}>
          <View style={styles.roles} accessibilityRole="radiogroup">
            <Text style={styles.label}>PERFIL</Text>
            {SIGNUP_ROLES.map((item) => {
              const selected = role === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  onPress={() => setRole(item.value)}
                  style={[styles.role, selected && styles.roleSelected]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]} />
                  <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{item.label}</Text>
                </Pressable>
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
          <Button title="Já tenho conta" variant="outline" onPress={onBack} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '800', color: colors.greenDark, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.greenMuted, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.greenDark, letterSpacing: 0.3 },
  roles: { gap: 8 },
  role: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white
  },
  roleSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white },
  radioSelected: { borderColor: colors.green, backgroundColor: colors.green },
  roleText: { fontSize: 15, color: colors.greenDark },
  roleTextSelected: { fontWeight: '700' },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  }
});
