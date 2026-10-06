export function renderProductCard(product) {
  return `
    <div style="background: white; border-radius: 8px; padding: 12px; margin: 8px; border: 1px solid #e2e8f0;">
      <div style="background: ${product.color || '#f1f5f9'}; height: 80px; border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 32px;">
        ${product.emoji}
      </div>
      <h3 style="font-size: 14px; margin-top: 8px;">${product.name}</h3>
      <p style="color: var(--forest); font-weight: bold; margin-top: 4px;">R$ ${product.price.toFixed(2)}</p>
      <button onclick="addToCart('${product.id}')" style="width: 100%; background: var(--forest); color: white; border: none; padding: 8px; border-radius: 4px; margin-top: 8px; cursor: pointer;">Adicionar</button>
    </div>
  `;
}