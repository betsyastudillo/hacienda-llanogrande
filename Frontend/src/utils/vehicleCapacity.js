export const OVERSIZE_FACTOR = 3     // la capacidad supera al pedido más de 3 veces
export const TIGHT_RATIO = 0.9       // el pedido usa 90 % o más de la capacidad

const tons = (kg) => `${(kg / 1000).toFixed(1).replace('.', ',')} t`

export function capacityStatus(capacityKg, weightKg) {
  const capacity = Number(capacityKg)
  const weight = Number(weightKg)

  if (!capacity || !weight) return { level: 'unknown', message: '' }

  if (weight > capacity) {
    return {
      level: 'short',
      message: `No alcanza: el pedido pesa ≈ ${tons(weight)} y este tipo carga ${tons(capacity)} (faltan ${tons(weight - capacity)}).`,
    }
  }

  if (weight >= capacity * TIGHT_RATIO) {
    return {
      level: 'tight',
      message: `Cabe muy justo: el pedido pesa ≈ ${tons(weight)} y este tipo carga ${tons(capacity)}. El peso es aproximado.`,
    }
  }

  if (capacity > weight * OVERSIZE_FACTOR) {
    return {
      level: 'oversized',
      message: `Es muy grande para este pedido: carga ${tons(capacity)} y el pedido pesa ≈ ${tons(weight)}.`,
    }
  }

  return {
    level: 'ok',
    message: `Capacidad suficiente: ${tons(capacity)} para ≈ ${tons(weight)}.`,
  }
}