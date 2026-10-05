// Listas vinculantes para revisar de las empresas, se hace un "check list" para que quien cree, verifique que buscó información en estas listas.
export const COMPLIANCE_CHECKS_COMMON = [
  { key: 'listas_vinculantes', label: 'Listas vinculantes (ONU, OFAC/Lista Clinton)' },
  { key: 'antecedentes_judiciales', label: 'Antecedentes judiciales (Policía Nacional)' },
]

// Por sector: construcción o agro, se pueden agregar más listas vinculantes según el sector de la empresa.
export const COMPLIANCE_CHECKS_BY_SECTOR = {
  construccion: [
    { key: 'dian_proveedores_ficticios', label: 'Boletín de Proveedores Ficticios (DIAN)' },
  ],
  agro: [
    { key: 'contrabando', label: 'Listados de control de contrabando' },
  ],
}

export function getComplianceLabel(key) {
  const all = [
    ...COMPLIANCE_CHECKS_COMMON,
    ...Object.values(COMPLIANCE_CHECKS_BY_SECTOR).flat(),
  ]
  return all.find((c) => c.key === key)?.label || key
}

export function getComplianceChecks(sector) {
  return [...COMPLIANCE_CHECKS_COMMON, ...(COMPLIANCE_CHECKS_BY_SECTOR[sector] || [])]
}