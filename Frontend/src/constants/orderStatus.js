import { Truck, PackageCheck, FileCheck, FileText, BanknoteCheck, ScrollText, Ban } from 'lucide-react'

export const ORDER_STATUS_STEPS = [
  { key: 'created', abrev: 'CR', label: 'Creado' },
  { key: 'payment_confirmed', abrev: 'PC', label: 'Pago confirmado' },
  { key: 'facturado', abrev: 'FA', label: 'Facturado' },
  { key: 'transport_validated', abrev: 'TC', label: 'Transporte confirmado' },
  { key: 'dispatch_guide_generated', abrev: 'GG', label: 'Guía generada' },
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
  transport_validated: 'Vehículo y transportador validados y aprobados.',
  dispatch_guide_generated: 'Guía de despacho generada.',
  dispatched: 'Pedido despachado.',
  cancelled: 'Pedido anulado.',
}

export const STATUS_ICONS = {
  created: FileText,
  payment_confirmed: BanknoteCheck,
  transport_validated: Truck,
  dispatch_guide_generated: ScrollText,
  dispatched: PackageCheck,
  facturado: FileCheck,
  cancelled: Ban,
}

export const STATUS_COLORS = {
  created: { bg: '#E5E3DB', text: '#5F5E5A' }, 
  payment_confirmed: { bg: '#DCEAFB', text: '#1E4E8C' },
  transport_validated: { bg: '#E6DFFB', text: '#4B2E8C' },
  dispatch_guide_generated: { bg: '#FCE8C4', text: '#8A5A0A' },
  dispatched: { bg: '#D3F3F0', text: '#0F6B63' },   
  facturado: { bg: '#D9F0DC', text: '#1F5C29' },  
  cancelled: {bg: '#E5E3DB', text: '#5F5E5A'}
}