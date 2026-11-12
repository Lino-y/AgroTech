// Identidade visual da web (src/styles/tokens.css e src/modules/catalog.js), em valores para o app.
// A fonte da web (Outfit) não entra aqui: usa a fonte do sistema para não adicionar dependência.
export const colors = {
  paper: '#F4FBF7',
  white: '#FFFFFF',
  green: '#2E7D32',
  greenDark: '#1B5E20',
  greenMuted: '#388E3C',
  greenSoft: '#E8F5E9',
  border: '#C8E6C9',
  textMuted: '#6C8574',
  gold: '#FBBF24',
  danger: '#C62828',
  dangerSoft: '#FFEBEE',
  // Aviso (modo offline): o amarelo do cupom da web, com texto escuro para contraste.
  noticeSoft: '#FFF8E1',
  noticeText: '#7A5300'
} as const;

// Alvo de toque mínimo recomendado para o Android (48 dp) e para o iOS (44 pt).
export const MIN_TOUCH = 48;

export const radius = { card: 16, control: 12, field: 10 } as const;
