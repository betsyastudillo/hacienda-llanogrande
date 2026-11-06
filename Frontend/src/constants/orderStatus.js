import { PackageCheck, FileCheck, FileText, BanknoteCheck, Truck, Ban } from 'lucide-react'

export const ORDER_STATUS_STEPS = [
  { key: 'created', abrev: 'CR', label: 'Creado' },
  { key: 'payment_confirmed', abrev: 'PC', label: 'Pago confirmado' },
  { key: 'facturado', abrev: 'FA', label: 'Facturado' },
  { key: 'partially_dispatched', abrev: 'DP', label: 'Despacho parcial' },
  { key: 'dispatched', abrev: 'DE', label: 'Despachado' },
]

export const STATUS_LABELS = {
  ...Object.fromEntries(ORDER_STATUS_STEPS.map((step) => [step.key, step.abrev])),
  cancelled: 'A',
}

export const STATUS_DESCRIPTIONS = {
  created: 'Pedido creado. En espera de pago.',
  payment_confirmed: 'Pago confirmado. Se está emitiendo la factura',
  facturado: 'Factura emitida. Pendiente: información de transporte.',
  partially_dispatched: 'Parte del pedido ya salió. Quedan cantidades por retirar.',
  dispatched: 'Pedido despachado.',
  cancelled: 'Pedido anulado.',
}

export const STATUS_ICONS = {
  created: FileText,
  payment_confirmed: BanknoteCheck,
  partially_dispatched: Truck,
  dispatched: PackageCheck,
  facturado: FileCheck,
  cancelled: Ban,
}

export const STATUS_COLORS = {
  created: { bg: '#E5E3DB', text: '#5F5E5A' }, 
  payment_confirmed: { bg: '#DCEAFB', text: '#1E4E8C' },
  facturado: { bg: '#D9F0DC', text: '#1F5C29' },  
  partially_dispatched: { bg: '#E6DFFB', text: '#4B2E8C' },
  dispatched: { bg: '#D3F3F0', text: '#0F6B63' },   
  cancelled: {bg: '#E5E3DB', text: '#5F5E5A'}
}