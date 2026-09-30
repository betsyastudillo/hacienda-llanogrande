export const JURIDICA_DOCUMENT_TYPES = [
  { value: 'camara_comercio', label: 'Cámara de Comercio' },
  { value: 'rut', label: 'RUT' },
  { value: 'cedula_representante', label: 'Cédula del representante legal' },
  { value: 'otro', label: 'Otro' },
]

export const REQUIRED_JURIDICA_DOCS = ['camara_comercio', 'rut', 'cedula_representante']
export const NATURAL_DOCUMENT_TYPES = [
  { value: 'cedula_ciudadania', label: 'Cédula de ciudadanía' },
  { value: 'rut', label: 'RUT (si aplica)' },
  { value: 'otro', label: 'Otro' },
]

export const REQUIRED_NATURAL_DOCS = ['cedula_ciudadania', 'rut']