// utils/formatQuantity.js
const plural = (n, singular, pluralForm) => (Number(n) === 1 ? singular : pluralForm)

export function formatQuantity(quantity, product, parent) {
  if (!product) return String(quantity)

  // Es un paquete: tiene producto padre y unidades por paquete
  if (product.parent_product_id && product.units_per_pack) {
    const inside = Number(product.units_per_pack)
    const unit = parent?.unit && parent.unit !== 'unidad' ? parent.unit : 'unidades'
    return `${quantity} ${plural(quantity, 'pqt', 'pqts')}`
  }

  return `${quantity} ${product.unit}`
}