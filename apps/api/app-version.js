// @ts-check
// Versão mínima do app (GET /api/app-config), lida de APP_MIN_VERSION. Fica fora do server.js para
// ser testada direto, sem subir processo com configuração ruim: esses processos saem cedo e
// tiram o servidor do relatório de cobertura (o relatório junta os processos-filhos pelo último).

const FORMAT = /^\d+\.\d+\.\d+$/;

/**
 * Lê a variável de ambiente. Sem a variável, nenhum app é barrado (0.0.0). Variável definida mas
 * fora do formato, inclusive vazia, é erro: o servidor não deve subir com a checagem desligada em silêncio.
 * @param {string | undefined} raw
 * @returns {{ version: string } | { error: string }}
 */
export function readAppMinVersion(raw) {
  if (raw === undefined) return { version: '0.0.0' };
  if (!FORMAT.test(raw)) {
    return { error: `APP_MIN_VERSION inválida (${JSON.stringify(raw)}): use MAJOR.MINOR.PATCH, ex.: 1.2.0.` };
  }
  return { version: raw };
}

/**
 * O app (cabeçalho X-App-Version) está abaixo da versão mínima? Versão fora do formato conta como
 * abaixo: um app que não informa direito a própria versão não deve passar pela checagem.
 * @param {string} version
 * @param {string} min
 */
export function isBelowMinVersion(version, min) {
  if (!FORMAT.test(version)) return true;
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
