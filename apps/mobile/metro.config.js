/* global require, module, __dirname -- configuração do Metro: roda no Node (CommonJS), não no app. */
// O app usa as regras de packages/domain direto, sem cópia (ADR-0002): o Metro precisa observar
// essa pasta, que fica fora de apps/mobile.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../../packages')];

module.exports = config;
