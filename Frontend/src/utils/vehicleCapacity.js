// Si la capacidad supera al pedido por más de este factor, se avisa que es muy grande
export const OVERSIZE_FACTOR = 3

export function capacityStatus(capacityKg, weightKg) {
  const capacity = Number(capacityKg)
  const weight = Number(weightKg)

  // Sin capacidad del tipo o sin peso estimado del pedido no se puede comparar
  if (!capacity || !weight) return { level: 'unknown', message: '' }

  if (weight > capacity) {
    return {
      level: 'short',
      message: `No alcanza: el pedido pesa ≈ ${weight.toFixed(0)} kg y este tipo carga ${capacity.toFixed(0)} kg (faltan ${(weight - capacity).toFixed(0)} kg).`,
    }
  }
  if (capacity > weight * OVERSIZE_FACTOR) {
    return {
      level: 'oversized',
      message: `Es muy grande para este pedido: carga ${capacity.toFixed(0)} kg y el pedido pesa ≈ ${weight.toFixed(0)} kg.`,
    }
  }
  return {
    level: 'ok',
    message: `Capacidad suficiente: ${capacity.toFixed(0)} kg para ≈ ${weight.toFixed(0)} kg.`,
  }
}