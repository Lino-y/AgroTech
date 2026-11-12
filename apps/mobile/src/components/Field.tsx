import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Tap } from './Tap.tsx';
import { colors, MIN_TOUCH, radius, space } from '../theme.ts';

type FieldProps = TextInputProps & {
  /** Rótulo sempre visível acima do campo (o placeholder some ao digitar). */
  label: string;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
  /** Campo de senha: esconde o texto e mostra o botão Mostrar/Ocultar. */
  secret?: boolean;
};

export function Field({ label, inputRef, secret, style, ...input }: FieldProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={secret && !visible}
          style={[styles.input, secret && styles.secretInput, style]}
          {...input}
        />
        {secret ? (
          <Tap
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setVisible((value) => !value)}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
          </Tap>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.field,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    fontSize: 15,
    color: colors.foreground
  },
  secretInput: { paddingRight: 88 },
  toggle: {
    position: 'absolute',
    right: 0,
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: 12,
    justifyContent: 'center'
  },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.primary }
});
