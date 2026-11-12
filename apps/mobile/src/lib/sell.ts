// Regras do formulário de anúncio. Limites iguais aos de POST /api/products (apps/api/server.js);
// o servidor valida tudo de novo.
const MAX_PRICE = 10_000_000;
const MAX_STOCK = 1_000_000;

/**
 * Preço digitado no padrão brasileiro: "89,90", "1.234,56", "R$ 150". Ponto seguido de 3 dígitos é
 * milhar ("1.500" = 1500); com 1 ou 2 dígitos é decimal ("89.9"). NaN quando não é número.
 */
export function parsePriceBR(text: string): number {
  const raw = text.replace(/R\$/i, '').replace(/\s/g, '');
  if (!raw) return Number.NaN;
  if (raw.includes(',')) {
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(raw)) return Number.NaN;
    return Number(raw.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ''));
  return /^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : Number.NaN;
}

export type ProductForm = { name: string; price: string; category: string; description: string; stock: string };

/** Primeira mensagem de erro do anúncio, ou null quando dá para enviar. */
export function validateProduct(form: ProductForm): string | null {
  if (!form.name.trim()) return 'Informe o nome do produto.';
  const price = parsePriceBR(form.price);
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    return 'Informe um preço maior que zero (até R$ 10.000.000).';
  }
  if (!form.category) return 'Escolha a categoria.';
  if (!form.description.trim()) return 'Descreva o produto.';
  const stock = Number(form.stock.trim());
  if (!/^\d+$/.test(form.stock.trim()) || stock > MAX_STOCK) return 'O estoque é um número inteiro de 0 a 1.000.000.';
  return null;
}

export type Draft = {
  name: string;
  price: number | null;
  unit: string | null;
  category: string | null;
  stock: number | null;
  location: string | null;
  description: string;
};

/**
 * Rascunho da "IA" do anúncio (draftFromPrompt, packages/domain/listing.js) no formato do formulário do
 * app: preço em reais com vírgula, categoria só se for uma das do app. Campo que a IA não achou fica de
 * fora, para não apagar o que a pessoa já digitou.
 */
export function draftToForm(draft: Draft, categories: string[]): Partial<ProductForm & { unit: string; location: string }> {
  const form: Partial<ProductForm & { unit: string; location: string }> = { name: draft.name, description: draft.description };
  if (draft.price) form.price = draft.price.toFixed(2).replace('.', ',');
  if (draft.category && categories.includes(draft.category)) form.category = draft.category;
  if (draft.stock) form.stock = String(draft.stock);
  if (draft.unit) form.unit = draft.unit;
  if (draft.location) form.location = draft.location;
  return form;
}
