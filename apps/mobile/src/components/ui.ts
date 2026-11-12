// Estilos repetidos entre as telas (cartão, título de seção, mensagens), com os tokens do tema.
import { StyleSheet } from 'react-native';
import { colors, fonts, MIN_TOUCH, radius } from '../theme.ts';

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8
  },
  sectionTitle: { fontSize: 16, fontFamily: fonts.heading, color: colors.foreground },
  text: { fontSize: 14, color: colors.foreground },
  muted: { fontSize: 13, color: colors.mutedForeground },
  error: {
    color: colors.destructive,
    backgroundColor: colors.destructiveSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  },
  success: {
    color: colors.foreground,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  },
  notice: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.control,
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.warningForeground
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  chipTextSelected: { color: colors.onPrimary },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground, letterSpacing: 0.3 }
});
