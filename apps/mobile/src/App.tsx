import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { CatalogScreen } from './screens/CatalogScreen.tsx';
import type { User } from './services/auth.ts';
import { getSession, setSecureStore } from './services/storage.ts';
import { colors } from './theme.ts';

// Mesmo fluxo da web: o app abre no catálogo, com ou sem conta; entrar é uma escolha.
type Screen = 'loading' | 'catalog' | 'auth';

// Troca de tela fica aqui; token e HTTP ficam nos services (camadas da ADR-0001).
export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('loading');
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setSecureStore(SecureStore);
    getSession().then((session) => {
      setUserName(session ? String(session.user.name ?? '') : null);
      setScreen('catalog');
    });
  }, []);

  if (screen === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  function authenticated(user: User): void {
    setUserName(user.name);
    setScreen('catalog');
  }

  // SafeAreaProvider mede as barras do aparelho (status em cima, navegação embaixo): o Android desenha
  // o app por baixo delas (ponta a ponta), então cada tela reserva esse espaço.
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen === 'auth' ? (
        <AuthScreen onAuthenticated={authenticated} onBack={() => setScreen('catalog')} />
      ) : (
        <CatalogScreen userName={userName} onSignIn={() => setScreen('auth')} onSignedOut={() => setUserName(null)} />
      )}
    </SafeAreaProvider>
  );
}
