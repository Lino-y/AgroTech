// Endereço da API. O Expo troca `process.env.EXPO_PUBLIC_API_URL` pelo valor do build, então o APK
// fala com o servidor configurado na hora de gerar (ex.: http://192.168.0.10:3001 na rede local).
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Versão do app (igual a app.json, conferido em teste). Vai no cabeçalho X-App-Version (spec 05). */
export const APP_VERSION = '0.4.2';
