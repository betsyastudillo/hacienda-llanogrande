import { CircleCheck, CircleX, Clock, Ban } from 'lucide-react'

export const PAYMENT_STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  failed: 'Rechazado',
  cancelled: 'Anulado',
}

// Copia los mismos colores que usas en companyStatus para
// pending / approved / rejected, así se ven iguales en toda la app
export const PAYMENT_STATUS_COLORS = {
  pending: { bgColor: '#fdf1b8', textColor: '#7a5c00' },
  confirmed: { bgColor: '#d9efdc', textColor: '#1f6b34' },
  failed: { bgColor: '#fbdcdc', textColor: '#a12a2a' },
  cancelled: { bgColor: '#e5e3db', textColor: '#5f5e5a'}
}

export const PAYMENT_STATUS_ICONS = {
  pending: Clock,
  confirmed: CircleCheck,
  failed: CircleX,
  cancelled: Ban
}