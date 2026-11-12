import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { ui } from '../components/ui.ts';
import { formatDateTime } from '../lib/catalog.ts';
import { createResetCode, loadUsers, type AdminUser } from '../services/admin.ts';
import { ApiError } from '../services/api.ts';
import { colors } from '../theme.ts';

type Props = { onBack: () => void };

// ADMIN: usuários e o código de redefinição de senha, que o ADMIN repassa por fora (telefone,
// WhatsApp). O servidor só aceita ADMIN (403 para os outros).
export function AdminUsersScreen({ onBack }: Props): React.JSX.Element {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, { code: string; expiresAt: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsers(await loadUsers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar os usuários.');
      setUsers((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(user: AdminUser): Promise<void> {
    setBusy(user.id);
    try {
      const result = await createResetCode(user.id);
      setCodes((current) => ({ ...current, [user.id]: result }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o código.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Usuários" subtitle="Gere o código para quem esqueceu a senha" onBack={onBack} />
      {users === null ? (
        <View style={ui.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(user) => user.id}
          contentContainerStyle={ui.scroll}
          ListHeaderComponent={error ? <Text style={ui.error}>{error}</Text> : undefined}
          renderItem={({ item }) => {
            const code = codes[item.id];
            return (
              <View style={ui.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={ui.muted}>
                  {item.email} · {item.role}
                </Text>
                {code ? (
                  <View style={styles.codeBox} accessibilityLiveRegion="polite">
                    <Text style={ui.muted}>Código (repasse à pessoa):</Text>
                    <Text selectable style={styles.code}>
                      {code.code}
                    </Text>
                    <Text style={ui.muted}>Vale até {formatDateTime(code.expiresAt)}, uma vez só.</Text>
                  </View>
                ) : null}
                <Button
                  title={code ? 'Gerar outro código' : 'Gerar código de senha'}
                  variant="outline"
                  loading={busy === item.id}
                  onPress={() => generate(item)}
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  codeBox: { backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, gap: 4 },
  code: { fontSize: 24, fontWeight: '800', letterSpacing: 4, color: colors.foreground }
});
