import { CircleCheck, CircleX, Clock } from 'lucide-react'

export const TRANSPORT_STATUS_LABELS = {
  pending: 'Pendiente de validación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

export const TRANSPORT_STATUS_COLORS = {
  pending: { bgColor: '#fdf1b8', textColor: '#7a5c00' },
  approved: { bgColor: '#d9efdc', textColor: '#1f6b34' },
  rejected: { bgColor: '#fbdcdc', textColor: 'var(--status-rejected-text)' },
}

export const TRANSPORT_STATUS_ICONS = {
  pending: Clock,
  approved: CircleCheck,
  rejected: CircleX,
}

// Estado de cada documento, incluidos los que no vienen de la base: "missing" y "expired"
export const TRANSPORT_DOC_STATE_LABELS = {
  missing: 'Falta',
  pending: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Vencido',
}

