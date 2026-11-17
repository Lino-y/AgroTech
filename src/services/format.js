// @ts-check

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

/**
 * Formata valores monetários no padrão brasileiro: 1234.5 -> "R$ 1.234,50".
 * Reaproveita uma única instância de Intl.NumberFormat (criar formatador a
 * cada chamada é caro, e este arquivo é chamado em toda renderização).
 * @param {unknown} value
 * @returns {string}
 */
export function formatBRL(value) {
  // Intl usa NBSP (U+00A0) antes do símbolo; normalizamos para espaço simples
  // para o valor ficar igual em HTML, toast e teste.
  return brlFormatter.format(Number(value || 0)).replaceAll('\u00A0', ' ');
}
