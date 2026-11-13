import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import app from '../../app.json';
import { Button } from '../components/Button.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import type { User } from '../services/auth.ts';
import { colors } from '../theme.ts';

type Props = {
  user: User | null;
  onLogin: () => void;
  onRegister: () => void;
  onOrders: () => void;
  onFavorites: () => void;
  onSupport: () => void;
  onAdmin: () => void;
  onServer: () => void;
  serverUrl: string;
  onLogout: () => void;
  /** Mercado Pago ligado no servidor: mostra "Receber pelo Mercado Pago" (vendedor) e "Pagamentos" (master). */
  payments?: 'simulado' | 'mercadopago';
  onReceive?: () => void;
  onPaymentsAdmin?: () => void;
};

const SELLER_ROLES = ['VENDEDOR', 'AMBOS'];

const ROLE_LABELS: Record<string, string> = {
  PRODUTOR: 'Comprador Rural (Produtor)',
  VENDEDOR: 'Vendedor / Fornecedor Agro',
  AMBOS: 'Comprador e Vendedor',
  ADMIN: 'Administrador'
};

// Conta: entrar ou criar conta (visitante); dados, pedidos, favoritos e sair (logado); suporte para
// todos; usuários e códigos de senha só para o ADMIN.
export function AccountScreen(props: Props): React.JSX.Element {
  const { user, onLogin, onRegister, onOrders, onFavorites, onSupport, onAdmin, onLogout, onServer, serverUrl } = props;
  const mercadoPago = props.payments === 'mercadopago';
  return (
    <View style={ui.screen}>
      <ScreenHeader title={user ? `Olá, ${user.name.split(' ')[0] || 'produtor'}` : 'Conta'} />
      <ScrollView contentContainerStyle={ui.scroll}>
        {user ? (
          <>
            <View style={ui.card}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={ui.muted}>{user.email}</Text>
              <Text style={ui.text}>{ROLE_LABELS[user.role] ?? user.role}</Text>
            </View>
            <Button title="Meus pedidos" variant="outline" onPress={onOrders} />
            <Button title="Meus favoritos" variant="outline" onPress={onFavorites} />
            {mercadoPago && SELLER_ROLES.includes(user.role) && props.onReceive ? (
              <Button title="Receber pelo Mercado Pago" variant="outline" onPress={props.onReceive} />
            ) : null}
            {mercadoPago && user.role === 'ADMIN' && props.onPaymentsAdmin ? (
              <Button title="Pagamentos (comissão e estornos)" variant="outline" onPress={props.onPaymentsAdmin} />
            ) : null}
            <Button title="Suporte" variant="outline" onPress={onSupport} />
            {user.role === 'ADMIN' ? <Button title="Usuários (gerar código de senha)" variant="outline" onPress={onAdmin} /> : null}
            <Button title="Sair da conta" variant="outline" onPress={onLogout} />
          </>
        ) : (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Entre ou crie sua conta</Text>
            <Text style={ui.muted}>Com a conta você compra, anuncia seus produtos e acompanha o financeiro.</Text>
            <Button title="Entrar" onPress={onLogin} />
            <Button title="Criar conta" variant="outline" onPress={onRegister} />
            <Button title="Suporte" variant="outline" onPress={onSupport} />
          </View>
        )}
        <Button title="Servidor" variant="outline" onPress={onServer} />
        <Text style={styles.version}>
          AgroTech v{app.expo.version} · versão de teste · servidor {serverUrl}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  version: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }
});
