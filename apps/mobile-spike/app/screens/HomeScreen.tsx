// Spike da issue #11 (Fase 0 da spec 08): tela autenticada mínima.
// A tela só lê estado; token e HTTP ficam nos services (ADR-0001, camadas).

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loadMe, type Me } from './services/api';
import { getSession, clearSession, type Session } from './services/storage';

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'authenticated'; user: Me['user'] }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string };

export function HomeScreen(): React.JSX.Element {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      const session: Session | null = await getSession();
      if (!session) {
        if (active) setState({ kind: 'unauthenticated' });
        return;
      }
      try {
        const me = await loadMe();
        if (active) setState({ kind: 'authenticated', user: me.user });
      } catch (error) {
        // 401 já limpou a sessão dentro do apiRequest; aqui só reflete a tela.
        const message = error instanceof Error ? error.message : 'Erro inesperado.';
        if (active) {
          await clearSession();
          setState({ kind: 'error', message });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state.kind === 'authenticated') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>AgroTech</Text>
        <Text testID="welcome">Olá, {state.user.name}</Text>
        <Text testID="role">{state.user.role}</Text>
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <Text testID="session-ended" style={styles.title}>
        {state.kind === 'error' ? state.message : 'Faça login para continuar.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }
});
