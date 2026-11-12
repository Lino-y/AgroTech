import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { CatalogScreen } from './screens/CatalogScreen.tsx';
import { LoginScreen } from './screens/LoginScreen.tsx';
import { RegisterScreen } from './screens/RegisterScreen.tsx';
import { getSession, setSecureStore } from './services/storage.ts';
import { colors } from './theme.ts';

// guest: catálogo sem conta (modo offline). catalog: catálogo com sessão aberta.
type Screen = 'loading' | 'login' | 'register' | 'catalog' | 'guest';

// Troca de tela fica aqui; token e HTTP ficam nos services (camadas da ADR-0001).
export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('loading');

  useEffect(() => {
    setSecureStore(SecureStore);
    getSession().then((session) => setScreen(session ? 'catalog' : 'login'));
  }, []);

  if (screen === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {screen === 'login' ? (
        <LoginScreen
          onLoggedIn={() => setScreen('catalog')}
          onRegister={() => setScreen('register')}
          onOffline={() => setScreen('guest')}
        />
      ) : screen === 'register' ? (
        <RegisterScreen onRegistered={() => setScreen('catalog')} onBack={() => setScreen('login')} />
      ) : (
        <CatalogScreen guest={screen === 'guest'} onLoggedOut={() => setScreen('login')} />
      )}
    </>
  );
}
