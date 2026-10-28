// @ts-check
// Ids dos registros novos do db.json, com o aleatório do Web Crypto (global no Node e no
// navegador), não com Date.now() nem Math.random(). Registro antigo mantém o id que tinha.

/**
 * @param {number} bytes
 * @returns {string} hexadecimal maiúsculo, 2 caracteres por byte
 */
const randomHex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

/**
 * Id de anúncio: UUID, porque não aparece na tela.
 * @returns {string}
 */
export const newProductId = () => crypto.randomUUID();

// ponytail: pedido e rastreio aparecem na tela, então seguem curtos, com 48 bits aleatórios
// (12 hex). A chance de repetir só passa de 50% perto de 20 milhões de registros (com os 5
// dígitos de antes, perto de 350 pedidos). Se o volume chegar lá, o id vira UUID e a tela
// ganha um código curto separado.

/** @returns {string} ex.: AGT-9F3A2C1B7D4E */
export const newOrderId = () => `AGT-${randomHex(6)}`;

/** @returns {string} ex.: BR-AGRO-9F3A2C1B7D4E-X */
export const newTrackingCode = () => `BR-AGRO-${randomHex(6)}-X`;
