// ESLint (flat config). Erro barra o commit (.githooks/pre-commit); aviso só alerta.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', '.qa/'] },
  js.configs.recommended,
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['server.js', 'tests/**/*.js', 'eslint.config.js'], languageOptions: { globals: globals.node } },
  { files: ['.ai/**/*.js', '.claude/**/*.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
  {
    rules: {
      // Alerta de função monolítica: não barra, mas não deixe o número de avisos subir.
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],
      // ponytail: 13 ocorrências antigas em 07/10/2026 (catalog.js, storage.js, tests).
      // Limpe e volte as duas para 'error'.
      'no-unused-vars': 'warn',
      'no-useless-escape': 'warn',
    },
  },
];
