// Agrupa de a 4 dígitos para mostrar: "12345678901" -> "1234 5678 901"
export function formatAccountNumber(value) {
  if (!value) return ''
  return String(value)
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}