// Los cuatro documentos requeridos; la llave es "sujeto:tipo", igual que missing_documents
export const TRANSPORT_DOCS = {
  'vehicle:soat': 'SOAT',
  'vehicle:tarjeta_propiedad': 'Tarjeta de propiedad',
  'carrier:cedula': 'Cédula del transportador',
  'carrier:licencia_conduccion': 'Licencia de conducción',
}

// VERIFICAR contra los tipos válidos de constants/transport_requirements.py
export const CARRIER_DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PP', label: 'Pasaporte' },
]