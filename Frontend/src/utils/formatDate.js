const MONTHS_SHORT = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
]

export function formatDate(value) {
  const date = new Date(value)
  // getDate fuerza a que siempre sean 2 dígitos
  const day = String(date.getDate()).padStart(2, '0')
  // getMonth se usa como índice para buscar el nombre corto en el array de months
  const month = MONTHS_SHORT[date.getMonth()]
  //getFullYear año completo, pero con el slice se recorta a los últimos 2
  const year = String(date.getFullYear()).slice(-2)

  return `${day}/ ${month} /${year}`
}

// Para fechas SIN hora (formato "YYYY-MM-DD", ej. las del kardex) —
// evita el desfase de un día que causa new Date() al asumir UTC.
export function formatDateOnly(value) {
  const [year, month, day] = value.split('-')
  return `${day}/ ${MONTHS_SHORT[Number(month) - 1]} /${year.slice(-2)}`
}

export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

export const daysLeft = (iso) => Math.ceil((new Date(`${iso}T00:00:00-05:00`) - new Date()) / 86400000)

// Días que faltan para una fecha AAAA-MM-DD (negativo si ya pasó), contados desde hoy en hora de Colombia
export const daysUntil = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  const [ty, tm, td] = todayISO().split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000)
}