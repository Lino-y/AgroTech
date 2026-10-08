export function getProductCategoryStyle(category = 'Outros') {
  const styles = {
    Rações: { emoji: '🐄', bg: '#E8F5E9' },
    Fertilizantes: { emoji: '🧪', bg: '#E8F5E9' },
    Grãos: { emoji: '🌽', bg: '#F1F8E9' },
    Máquinas: { emoji: '🚜', bg: '#E0F2F1' },
    Outros: { emoji: '📦', bg: '#F4FBF5' }
  };

  return Object.hasOwn(styles, category) ? styles[category] : styles.Outros;
}

export function buildProductDraft({
  name,
  price,
  category,
  imageUrl,
  description,
  userName,
  userEmail,
  unit = 'unidade',
  location = 'Região Agrícola - BR',
  stock = 100,
  shippingType = 'CIF - Entrega na Fazenda',
  certification = 'Nota Fiscal de Produtor e Laudo de Qualidade'
}) {
  const { emoji, bg } = getProductCategoryStyle(category);

  return {
    id: String(Date.now()),
    name,
    price: Number(price),
    category,
    unit,
    location,
    stock: Number(stock),
    shippingType,
    certification,
    image: imageUrl !== '' ? imageUrl : null,
    imageEmoji: emoji,
    imageBg: bg,
    rating: 5.0,
    reviewsCount: 1,
    description,
    ownerEmail: userEmail,
    sellerName: userName || 'Produtor Rural Anunciante',
    comments: [
      { author: userName || 'Produtor Anunciante', text: 'Lote disponível para envio com laudo e nota fiscal.', rating: 5 }
    ]
  };
}
