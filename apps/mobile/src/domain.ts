// Ponte única para as regras puras compartilhadas com a API e a web (packages/domain, ADR-0002).
// O caminho relativo longo fica só aqui; o Metro observa a pasta (metro.config.js).
export { calculateCartSummary, validateCouponCode, validatePassword, COUPON_RULES } from '../../../packages/domain/commerce.js';
export { buildSupportReply } from '../../../packages/domain/support.js';
export { draftFromPrompt } from '../../../packages/domain/listing.js';
export { summarizeFinance } from '../../../packages/domain/finance.js';
export { CATEGORY_STYLES, getProductCategoryStyle } from '../../../packages/domain/catalog.js';
