import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tap } from '../components/Tap.tsx';
import app from '../../app.json';
import { Button } from '../components/Button.tsx';
import type { User } from '../services/auth.ts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, MIN_TOUCH } from '../theme.ts';
import { LoginForm } from './LoginForm.tsx';
import { RegisterForm } from './RegisterForm.tsx';

type Mode = 'login' | 'register';
type Props = {
  onAuthenticated: (user: User) => void;
  onBack: () => void;
  initialMode?: Mode;
  /** Por que a entrada abriu (ex.: "finalizar a compra"), como o pendingScreen da web. */
  reason?: string | null;
};

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'login', label: 'Entrar' },
  { mode: 'register', label: 'Criar Conta' }
];

// Mesma tela da web: um só lugar com as abas Entrar | Criar Conta e a volta para o catálogo.
export function AuthScreen({ onAuthenticated, onBack, initialMode = 'login', reason }: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>(initialMode);
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* PNG gerado de assets/logo.svg da web: o RN não desenha SVG sem biblioteca nativa. */}
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Logo AgroTech"
        />
        <Text style={styles.brand}>AgroTech</Text>
        <Text style={styles.subtitle}>Faça login ou crie uma conta para {reason ?? 'comprar e anunciar'}.</Text>

        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((tab) => {
            const selected = mode === tab.mode;
            return (
              <Tap
                key={tab.mode}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setMode(tab.mode)}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
              </Tap>
            );
          })}
        </View>

        {mode === 'login' ? <LoginForm onLoggedIn={onAuthenticated} /> : <RegisterForm onRegistered={onAuthenticated} />}

        <View style={styles.back}>
          <Button title="Voltar" variant="outline" onPress={onBack} />
        </View>

        <Text style={styles.version}>AgroTech v{app.expo.version} · versão de teste</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  logo: { width: 160, height: 90, alignSelf: 'center', marginBottom: 8 },
  brand: { fontSize: 30, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.secondaryForeground, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20
  },
  tab: { flex: 1, minHeight: MIN_TOUCH - 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabSelected: { backgroundColor: colors.surface },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  tabTextSelected: { color: colors.foreground, fontWeight: '800' },
  back: { marginTop: 20 },
  version: { marginTop: 32, fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }
});
