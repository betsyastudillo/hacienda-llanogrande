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


export const TRANSPORT_CHECK_LABELS = {
  simit: 'SIMIT (multas)',
  listas_vinculantes: 'Listas vinculantes (ONU, OFAC/Lista Clinton)',
  antecedentes_judiciales: 'Antecedentes judiciales (Policía Nacional)',
}

export const TRANSPORT_CHECK_SUBJECTS = { vehicle: 'Vehículo', owner: 'Propietario', carrier: 'Transportador' }

export const BLOCKING_TRANSPORT_CHECKS = ['listas_vinculantes']

// Razones para el rechazo de algún documento
export const OTHER_REASON = '__otro__'

const GENERAL_REJECTION_REASONS = [
  'La imagen no se lee bien (borrosa, oscura o cortada)',
  'El documento está incompleto (falta el reverso u otras páginas)',
  'El documento no corresponde al tipo solicitado',
  'El documento está vencido',
]

// Motivos propios de cada documento; se muestran antes que los generales
const REJECTION_REASONS_BY_DOCUMENT = {
  soat: [
    'La placa del SOAT no coincide con la del vehículo',
  ],
  tarjeta_propiedad: [
    'La placa no coincide con la del vehículo',
    'El propietario no coincide con el declarado',
  ],
  documento_propietario: [
    'El documento no corresponde al propietario declarado',
  ],
  cedula: [
    'La cédula no corresponde al transportador declarado',
  ],
  licencia_conduccion: [
    'La licencia no corresponde al transportador declarado',
    'La categoría de la licencia no es apta para este tipo de vehículo',
    'La categoría de la licencia está vencida para este tipo de vehículo',
  ],
}

// Debe coincidir con EXPIRING_DOCUMENTS del backend
export const EXPIRING_TRANSPORT_DOCS = ['vehicle:soat', 'carrier:licencia_conduccion']
export const EXPIRY_WARNING_DAYS = 30

export const rejectionReasonsFor = (documentType) => [
  ...(REJECTION_REASONS_BY_DOCUMENT[documentType] || []),
  ...GENERAL_REJECTION_REASONS,
]