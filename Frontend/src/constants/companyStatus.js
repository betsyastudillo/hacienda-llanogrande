import { Clock, CircleCheck, CircleX } from 'lucide-react'

export const COMPANY_STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'No aprobada',
}

export const COMPANY_STATUS_COLORS = {
  pending: { bg: '#FFF2A0', text: '#5F5E5A' },
  approved: { bg: '#D9F0DC', text: '#1F5C29' },
  rejected: { bg: '#FCEBEB', text: '#791F1F' },
}

export const COMPANY_STATUS_ICONS = {
  pending: Clock,
  approved: CircleCheck,
  rejected: CircleX,
}