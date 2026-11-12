// Contraste dos tokens (WCAG): texto >= 4,5:1 e contorno de controle >= 3:1 (regras da skill
// ui-ux-pro-max, prioridade 1). Falha se um token novo ou alterado ficar ilegível.
import test from 'node:test';
import assert from 'node:assert/strict';
import { darkColors, lightColors } from '../src/theme.ts';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Colors = typeof lightColors;
const TEXT_PAIRS: [keyof Colors, keyof Colors][] = [
  ['foreground', 'background'],
  ['foreground', 'surface'],
  ['mutedForeground', 'background'],
  ['mutedForeground', 'surface'],
  ['mutedForeground', 'primarySoft'],
  ['secondaryForeground', 'background'],
  ['secondaryForeground', 'surface'],
  ['secondaryForeground', 'primarySoft'],
  ['primary', 'surface'],
  ['onPrimary', 'primary'],
  ['destructive', 'surface'],
  ['destructive', 'destructiveSoft'],
  ['warningForeground', 'warningSoft'],
  ['onOverlay', 'overlay']
];

for (const [theme, colors] of [['claro', lightColors], ['escuro', darkColors]] as const) {
  for (const [text, bg] of TEXT_PAIRS) {
    test(`tema ${theme}: texto ${text} sobre ${bg} tem contraste >= 4,5:1`, () => {
      const ratio = contrast(colors[text], colors[bg]);
      assert.ok(ratio >= 4.5, `${colors[text]} sobre ${colors[bg]}: ${ratio.toFixed(2)}`);
    });
  }

  test(`tema ${theme}: contorno de campo e controle tem contraste >= 3:1 na superfície e no fundo`, () => {
    assert.ok(contrast(colors.borderStrong, colors.surface) >= 3);
    assert.ok(contrast(colors.borderStrong, colors.background) >= 3);
  });
}

test('os dois temas têm as mesmas chaves', () => {
  assert.deepEqual(Object.keys(darkColors).sort(), Object.keys(lightColors).sort());
});
