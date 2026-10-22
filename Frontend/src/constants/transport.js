// Los cuatro documentos requeridos; la llave es "sujeto:tipo", igual que missing_documents
export const TRANSPORT_DOCS = {
  'vehicle:soat': 'SOAT',
  'vehicle:tarjeta_propiedad': 'Tarjeta de propiedad',
  'vehicle:documento_propietario': 'Cédula del propietario',
  'carrier:cedula': 'Cédula del transportador',
  'carrier:licencia_conduccion': 'Licencia de conducción',
}

export const CARRIER_DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PP', label: 'Pasaporte' },
  { value: 'PPT', label: 'Permiso por Protección Temporal' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia' },
]

// El dueño también puede ser una empresa (NIT)
export const OWNER_DOCUMENT_TYPES = [...CARRIER_DOCUMENT_TYPES, { value: 'NIT', label: 'NIT' }]

// Debe coincidir con VALID_VEHICLE_TYPES del backend
export const VEHICLE_TYPES = [
  { value: 'camioneta', label: 'Camioneta' },
  { value: 'camion_sencillo', label: 'Camión sencillo' },
  { value: 'doble_troque', label: 'Doble troque' },
  { value: 'tractomula', label: 'Tractomula' },
  { value: 'volqueta', label: 'Volqueta' },
]

export const vehicleTypeLabel = (value) => VEHICLE_TYPES.find((t) => t.value === value)?.label || value