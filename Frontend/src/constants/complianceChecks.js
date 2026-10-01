// Listas vinculantes para revisar de las empresas, se hace un "check list" para que quien cree, verifique que buscó información en estas listas.
export const COMPLIANCE_CHECKS_COMMON = [
  { key: 'listas_vinculantes', label: 'Listas vinculantes (ONU, OFAC/Lista Clinton)' },
  { key: 'antecedentes_judiciales', label: 'Antecedentes judiciales (Policía Nacional)' },
]

export const COMPLIANCE_CHECKS_BY_SECTOR = {
  construccion: [
    { key: 'dian_proveedores_ficticios', label: 'Boletín de Proveedores Ficticios (DIAN)' },
  ],
  agro: [
    { key: 'contrabando', label: 'Listados de control de contrabando' },
  ],
}

export function getComplianceChecks(sector) {
  return [...COMPLIANCE_CHECKS_COMMON, ...(COMPLIANCE_CHECKS_BY_SECTOR[sector] || [])]
}