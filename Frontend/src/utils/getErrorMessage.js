export function getErrorMessage(err, fallback) {
  const detail = err.response?.data?.detail

  if (typeof detail === 'string') return detail

  // En errores 422 FastAPI devuelve un arreglo de objetos, no un texto. Para más claridad
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${(d.loc || []).filter((p) => p !== 'body').join('.')}: ${d.msg}`)
      .join(' · ')
  }

  return fallback
}