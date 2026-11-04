export function suggestPickup(lines, capacityKg) {
  const usable = lines.filter((l) => l.unitWeightKg > 0 && l.balance > 0)
  const total = usable.reduce((s, l) => s + l.balance * l.unitWeightKg, 0)

  if (!capacityKg || !total) return null

  // Todo el saldo cabe en un solo retiro
  if (total <= capacityKg) {
    return {
      quantities: Object.fromEntries(usable.map((l) => [l.product_id, l.balance])),
      usedKg: total, complete: true, trips: 1, //trips: retiros minimos que faltan
    }
  }

  const ratio = capacityKg / total
  const qty = {}
  let used = 0

  usable.forEach((l) => {
    qty[l.product_id] = Math.floor(l.balance * ratio)
    used += qty[l.product_id] * l.unitWeightKg
  })

  // Llena el espacio que sobra, de a una unidad, mientras quepa
  let added = true
  while (added) {
    added = false
    for (const l of usable) {
      if (qty[l.product_id] < l.balance && used + l.unitWeightKg <= capacityKg) {
        qty[l.product_id] += 1
        used += l.unitWeightKg
        added = true
      }
    }
  }

  return { quantities: qty, usedKg: used, complete: false, trips: Math.ceil(total / capacityKg) }
}