// @ts-check
// Versões do app (MAJOR.MINOR.PATCH): a API usa para barrar app antigo (426) e o app, para avisar que
// há versão nova. Um lugar só para as duas pontas (ADR-0002).

const FORMAT = /^\d+\.\d+\.\d+$/;

/** @param {unknown} version */
export function isValidVersion(version) {
  return typeof version === 'string' && FORMAT.test(version);
}

/**
 * Compara número a número (0.10.0 é maior que 0.9.9). Use só com versões válidas.
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function compareVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}
