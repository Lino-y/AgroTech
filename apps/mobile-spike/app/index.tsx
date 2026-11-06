// Entrada do spike (issue #11). Só roda com Expo instalado, após o gate da ADR.
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './screens/HomeScreen';

export default function App(): React.JSX.Element {
  return (
    <>
      <StatusBar style="auto" />
      <HomeScreen />
    </>
  );
}
