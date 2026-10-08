import { CircleCheck, CircleX, Clock } from 'lucide-react'

export const PAYMENT_STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  failed: 'Rechazado',
}

// Copia los mismos colores que usas en companyStatus para
// pending / approved / rejected, así se ven iguales en toda la app
export const PAYMENT_STATUS_COLORS = {
  pending: { bgColor: '#fdf1b8', textColor: '#7a5c00' },
  confirmed: { bgColor: '#d9efdc', textColor: '#1f6b34' },
  failed: { bgColor: '#fbdcdc', textColor: '#a12a2a' },
}

export const PAYMENT_STATUS_ICONS = {
  pending: Clock,
  confirmed: CircleCheck,
  failed: CircleX,
}