// @ts-check
// Versões do app (GET /api/app-config): a mínima (APP_MIN_VERSION) e a mais nova para baixar
// (APP_LATEST_VERSION). Fica fora do server.js para ser testada direto, sem subir processo com
// configuração ruim: esses processos saem cedo e tiram o servidor do relatório de cobertura (o
// relatório junta os processos-filhos pelo último). A comparação mora no domínio (o app usa a mesma).
import { compareVersions, isValidVersion } from '../../packages/domain/version.js';

/**
 * Lê a variável de ambiente. Sem a variável, nenhum app é barrado (0.0.0). Variável definida mas
 * fora do formato, inclusive vazia, é erro: o servidor não deve subir com a checagem desligada em silêncio.
 * @param {string | undefined} raw
 * @returns {{ version: string } | { error: string }}
 */
export function readAppMinVersion(raw) {
  if (raw === undefined) return { version: '0.0.0' };
  if (!isValidVersion(raw)) {
    return { error: `APP_MIN_VERSION inválida (${JSON.stringify(raw)}): use MAJOR.MINOR.PATCH, ex.: 1.2.0.` };
  }
  return { version: raw };
}

/**
 * Versão mais nova publicada para download (APP_LATEST_VERSION). Sem a variável, null (o app não avisa
 * nada). Fora do formato é erro, como a mínima.
 * @param {string | undefined} raw
 * @returns {{ version: string | null } | { error: string }}
 */
export function readLatestVersion(raw) {
  if (raw === undefined) return { version: null };
  if (!isValidVersion(raw)) {
    return { error: `APP_LATEST_VERSION inválida (${JSON.stringify(raw)}): use MAJOR.MINOR.PATCH, ex.: 1.2.0.` };
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
  return !isValidVersion(version) || compareVersions(version, min) < 0;
}
