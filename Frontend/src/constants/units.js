export const VALID_UNITS = [
  { value: 'kg', label: 'Kilogramos' },
  { value: 'tonelada', label: 'Toneladas' },
  { value: 'unidad', label: 'Unidades' },
  { value: 'canasta', label: 'Canastas' },
  { value: 'bulto', label: 'Bultos' },
]

// Factor aproximado: kg promedio por 1 unidad de cada combinación producto+medida.
// Temporal — solo para mostrar un estimado en pantalla, no se guarda en la BD todavía.
export const APPROX_KG_PER_UNIT = {
  'Manzana|canasta': 20,
  'Ají|canasta': 12,
  'Uva|canasta': 10,
  'Manzana|bulto': 20,
  'Ají|bulto': 12,
  'Uva|bulto': 10,
  'tonelada': 1000,  // aplica sin importar el producto
}

export function estimateWeightKg(approx_weight_kg, unit, quantity) {
  if (unit === 'kg') return quantity
  if (unit === 'tonelada') return quantity * 1000

  if (!approx_weight_kg) return null //Si notiene el dato cargado aún, devuelve NULL

  return quantity * Number(approx_weight_kg)
}