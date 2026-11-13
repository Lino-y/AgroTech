import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { formatDate } from '../lib/catalog.ts';
import { isSafeAuthorizationUrl } from '../lib/payment.ts';
import { ApiError } from '../services/api.ts';
import { disconnectMp, loadMpStatus, startMpConnection, type MpStatus } from '../services/mercadopago.ts';
import { colors } from '../theme.ts';

type Props = { onBack: () => void };

// Vendedor (spec 10, RF-01): conecta a conta Mercado Pago para receber. Conectar abre a autorização no
// navegador; quando a pessoa volta ao app, a situação é lida de novo do servidor. Nenhum token passa aqui.
export function ReceivePaymentsScreen({ onBack }: Props): React.JSX.Element {
  const [status, setStatus] = useState<MpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await loadMpStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível ler a situação da conta.');
      setStatus((current) => current ?? { connected: false, expiresAt: null });
    }
  }, []);

  useEffect(() => {
    void load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);

  async function connect(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await startMpConnection();
      if (!isSafeAuthorizationUrl(url)) {
        setError('O servidor não mandou um link de autorização do Mercado Pago.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível começar a conexão. Tente com internet.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDisconnect(): void {
    Alert.alert('Desconectar a conta?', 'Seus anúncios continuam no catálogo, mas não podem ser comprados até você conectar de novo.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: () => {
          void disconnectMp()
            .then(load)
            .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível desconectar agora.'));
        }
      }
    ]);
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Receber pelo Mercado Pago" onBack={onBack} />
      <ScrollView contentContainerStyle={ui.scroll}>
        <View style={ui.card}>
          {status === null ? (
            <ActivityIndicator color={colors.primary} />
          ) : status.connected ? (
            <>
              <Text style={styles.ok}>Conta conectada</Text>
              {status.expiresAt ? <Text style={ui.muted}>Autorização válida até {formatDate(status.expiresAt)}; o AgroTech renova sozinho.</Text> : null}
            </>
          ) : (
            <Text style={styles.off}>Conta não conectada: seus produtos ainda não podem ser comprados pelo app.</Text>
          )}
        </View>
        <View style={ui.card}>
          <Text style={ui.text}>
            O comprador paga pelo Mercado Pago (Pix, cartão ou boleto) e o dinheiro cai direto na sua conta, já sem a taxa do Mercado Pago e a
            comissão da AgroTech.
          </Text>
          <Text style={ui.muted}>Ao conectar, o navegador abre o Mercado Pago. Autorize e volte ao app: a situação atualiza sozinha.</Text>
        </View>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={ui.error}>
            {error}
          </Text>
        ) : null}
        <Button title={status?.connected ? 'Conectar de novo' : 'Conectar conta Mercado Pago'} onPress={connect} loading={busy} />
        {status?.connected ? <Button title="Desconectar" variant="outline" onPress={confirmDisconnect} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ok: { fontSize: 16, fontWeight: '800', color: colors.primary },
  off: { fontSize: 15, fontWeight: '700', color: colors.warningForeground }
});
