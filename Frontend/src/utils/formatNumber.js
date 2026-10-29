// La base guarda 2 decimales ("150.00"); se muestra sin ceros sobrantes: 150 o 7,5
export const formatCapacity = (value) =>
  Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 })

// Para un input numérico, que necesita punto decimal: "150.00" -> "150"
export const capacityToInput = (value) => String(Number(value))