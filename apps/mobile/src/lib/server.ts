// Endereço do servidor digitado no app e aviso de versão nova. Funções puras.
import { compareVersions, isValidVersion } from '../domain.ts';

/**
 * Limpa o endereço digitado: põe http:// quando falta, tira a barra final e um /api colado junto.
 * Só aceita http(s) com host; qualquer outra coisa é null.
 */
export function normalizeServerUrl(input: string): string | null {
  let text = input.trim();
  if (!text) return null;
  // Protocolo só quando vem com "//" (http://, ftp://): "localhost:3001" é host e porta, não protocolo.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `http://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${url.protocol}//${url.host}${path}`;
}

export type AppConfig = { minVersion: string; latestVersion: string | null; downloadUrl: string | null };

/** Há versão mais nova para baixar? Devolve a versão e o link completo, ou null. */
export function availableUpdate(config: AppConfig, current: string, baseUrl: string): { version: string; url: string } | null {
  const { latestVersion, downloadUrl } = config;
  if (!latestVersion || !downloadUrl || !isValidVersion(latestVersion) || !isValidVersion(current)) return null;
  if (compareVersions(latestVersion, current) <= 0) return null;
  return { version: latestVersion, url: `${baseUrl}${downloadUrl}` };
}
