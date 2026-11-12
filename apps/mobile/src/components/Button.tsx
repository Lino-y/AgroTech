import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme.ts';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary: verde cheio (ação principal). outline: contorno (ação secundária). */
  variant?: 'primary' | 'outline';
  loading?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading = false }: ButtonProps): React.JSX.Element {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.base, primary ? styles.primary : styles.outline, (pressed || loading) && styles.busy]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.white : colors.green} />
      ) : (
        <Text style={[styles.text, !primary && styles.outlineText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: colors.green },
  outline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.green },
  busy: { opacity: 0.7 },
  text: { color: colors.white, fontSize: 16, fontWeight: '700' },
  outlineText: { color: colors.green }
});
