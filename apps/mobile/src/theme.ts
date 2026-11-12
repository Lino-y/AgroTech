// Tokens do app. Cores da marca vêm da web (src/styles/tokens.css e src/modules/catalog.js); os nomes
// são semânticos (papel, não tom), como pede a skill ui-ux-pro-max, e o contraste de cada par de
// texto é testado em __tests__/theme.test.ts. A fonte da web (Outfit) não entra: fonte do sistema.
export const colors = {
  background: '#F4FBF7',
  surface: '#FFFFFF',
  foreground: '#1B5E20',
  /** Texto secundário neutro (dicas, datas, legendas). Era #6C8574 (3,8:1, abaixo de 4,5). */
  mutedForeground: '#52695A',
  /** Texto secundário verde (contagens, avisos leves). Era #388E3C (3,9:1). */
  secondaryForeground: '#2A6F2E',
  primary: '#2E7D32',
  onPrimary: '#FFFFFF',
  primarySoft: '#E8F5E9',
  /** Borda decorativa de cartão (não carrega informação). */
  border: '#C8E6C9',
  /** Contorno de campo, chip e controle: >= 3:1 (não-texto). Era a borda decorativa (1,3:1). */
  borderStrong: '#6E9A79',
  /** Dourado da colheita (cupom e aviso da web). */
  accent: '#FBBF24',
  destructive: '#C62828',
  destructiveSoft: '#FFEBEE',
  warningSoft: '#FFF8E1',
  warningForeground: '#7A5300',
  /** Selo sobre foto (local do anúncio). */
  overlay: '#163D27',
  onOverlay: '#FFFFFF',
  /** Ripple do Android ao tocar. */
  ripple: '#C8E6C9'
} as const;

// Alvo de toque mínimo recomendado para o Android (48 dp) e para o iOS (44 pt).
export const MIN_TOUCH = 48;

export const radius = { card: 16, control: 12, field: 10, pill: 24 } as const;

/** Ritmo de 4/8 dp para padding, gap e espaço entre seções. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Escala de texto: nada abaixo de 12. */
export const fontSize = { caption: 12, small: 13, body: 15, lead: 16, title: 18, heading: 20, display: 26 } as const;

/** Tamanhos de ícone (um só por nível de hierarquia). */
export const iconSize = { sm: 16, md: 22, lg: 28, xl: 48 } as const;

/** Opacidade do estado pressionado (sem mexer no tamanho do elemento). */
export const PRESSED_OPACITY = 0.7;
