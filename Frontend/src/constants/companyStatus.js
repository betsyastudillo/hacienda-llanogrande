import { Clock, CircleCheck, CircleX, PencilLine } from 'lucide-react'

export const COMPANY_STATUS_LABELS = {
  draft: 'Borrador',
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'No aprobada',
}

export const COMPANY_STATUS_COLORS = {
  draft: { bg: '#E6EEF8', text: '#2F5D8A'},
  pending: { bg: '#FFF2A0', text: '#5F5E5A' },
  approved: { bg: '#D9F0DC', text: '#1F5C29' },
  rejected: { bg: '#FCEBEB', text: '#791F1F' },
}

export const COMPANY_STATUS_ICONS = {
  draft: PencilLine,
  pending: Clock,
  approved: CircleCheck,
  rejected: CircleX,
}