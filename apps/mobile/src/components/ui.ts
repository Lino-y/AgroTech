// Estilos repetidos entre as telas (cartão, título de seção, mensagens), com os tokens do tema.
import { StyleSheet } from 'react-native';
import { colors, MIN_TOUCH, radius } from '../theme.ts';

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(200,230,201,0.8)',
    padding: 14,
    gap: 8
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.greenDark },
  text: { fontSize: 14, color: colors.greenDark },
  muted: { fontSize: 13, color: colors.textMuted },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  },
  success: {
    color: colors.greenDark,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.field,
    padding: 12,
    fontSize: 14,
    fontWeight: '600'
  },
  notice: {
    backgroundColor: colors.noticeSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.control,
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.noticeText
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.green },
  chipTextSelected: { color: colors.white },
  label: { fontSize: 13, fontWeight: '700', color: colors.greenDark, letterSpacing: 0.3 }
});
