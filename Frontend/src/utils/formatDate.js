const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sept', 'oct', 'nov', 'dic',
]

export function formatDate(value) {
  const date = new Date(value)
  // getDate fuerza a que siempre sean 2 dígitos
  const day = String(date.getDate()).padStart(2, '0')
  // getMonth se usa como índice para buscar el nombre corto en el array de months
  const month = MONTHS_SHORT[date.getMonth()]
  //getFullYear año completo, pero con el slice se recorta a los últimos 2
  const year = String(date.getFullYear()).slice(-2)

  return `${day}/${month}/${year}`
}