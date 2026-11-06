// Reparte lo pendiente de un pedido para lo que cabe en un vehículo.

export function suggestPickup(lines, capacityKg) {
  if (!capacityKg || capacityKg <= 0 || lines.length === 0) return null
  if (lines.some((l) => !l.unitKg || l.unitKg <=0)) return null

  const totalKg = lines.reduce((sum, l) => sum + l.pending * l.unitKg, 0)
  const trips = Math.max(1, Math.ceil(totalKg / capacityKg))

  // Todo cabe en un solo retiro
  if (totalKg <= capacityKg) {
    return {
      quantities: Object.fromEntries(lines.map((l) => [l.id, l.pending])),
      usedKg: totalKg,
      complete: true,
      trips: 1,
    }
  }

  // Cada producto lleva la misma fracción de lo que falta
  const ratio = capacityKg / totalKg
  const quantities = {}
  let usedKg = 0

  for (const l of lines) {
    const q = Math.min(l.pending, Math.floor(l.pending * ratio))
    quantities[l.id] = q
    usedKg += q * l.unitKg
  }

  // Lo que sobra de capacidad se llena con unds sueltas, empezando por las más pesadas
  let remaining = capacityKg - usedKg

  for (const l of [...lines].sort((a, b) => b.unitKg - a.unitKg)) {
    const extra = Math.min(l.pending - quantities[l.id], Math.floor((remaining + 1e-9) / l.unitKg))

    if (extra > 0) {
      quantities[l.id] += extra
      remaining -= extra * l.unitKg
    }
  }

  return { quantities, usedKg: capacityKg - remaining, complete: false, trips}
}