// Ícone do APK (issue #89): sem "icon" e "adaptiveIcon" no app.json, o Android mostra o ícone padrão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lightColors } from '../src/theme.ts';

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

/** Largura, altura e tipo de cor (6 = RGBA) lidos do cabeçalho IHDR do PNG. */
function pngInfo(path: string): { width: number; height: number; colorType: number } {
  const data = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(data.subarray(1, 4).toString('latin1'), 'PNG', `${path} não é PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] };
}

test('app.json declara o ícone e o ícone adaptável do Android', () => {
  assert.equal(app.icon, './assets/icon.png');
  assert.equal(app.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png');
  assert.equal(app.android.adaptiveIcon.backgroundColor, lightColors.primary, 'fundo é a cor da marca');
});

test('os ícones são quadrados de 1024 px; o da frente do adaptável tem transparência', () => {
  const icon = pngInfo(app.icon.replace('./', ''));
  assert.deepEqual([icon.width, icon.height], [1024, 1024]);
  const foreground = pngInfo(app.android.adaptiveIcon.foregroundImage.replace('./', ''));
  assert.deepEqual([foreground.width, foreground.height, foreground.colorType], [1024, 1024, 6]);
});
