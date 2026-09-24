import { Truck, PackageCheck, FileCheck, FileText, BanknoteCheck, ScrollText } from 'lucide-react'

export const ORDER_STATUS_STEPS = [
  { key: 'created', abrev: 'C', label: 'Creado' },
  { key: 'payment_confirmed', abrev: 'PC', label: 'Pago confirmado' },
  { key: 'transport_validated', abrev: 'TC', label: 'Transporte confirmado' },
  { key: 'dispatch_guide_generated', abrev: 'GG', label: 'Guía generada' },
  { key: 'dispatched', abrev: 'D', label: 'Despachado' },
  { key: 'facturado', abrev: 'F', label: 'Facturado' },
]

export const STATUS_LABELS = Object.fromEntries(
  ORDER_STATUS_STEPS.map((step) => [step.key, step.abrev])
)

export const STATUS_DESCRIPTIONS = {
  created: 'Pedido creado. En espera de pago.',
  payment_confirmed: 'Pago confirmado. Pendiente: información de transporte.',
  transport_validated: 'Vehículo y transportista validados y aprobados.',
  dispatch_guide_generated: 'Guía de despacho generada.',
  dispatched: 'Pedido despachado.',
  facturado: 'Pedido entregado y facturado.',
}

export const STATUS_ICONS = {
  created: FileText,
  payment_confirmed: BanknoteCheck,
  transport_validated: Truck,
  dispatch_guide_generated: ScrollText,
  dispatched: PackageCheck,
  facturado: FileCheck,
}

export const STATUS_COLORS = {
  created: { bg: '#E5E3DB', text: '#5F5E5A' }, 
  payment_confirmed: { bg: '#DCEAFB', text: '#1E4E8C' },
  transport_validated: { bg: '#E6DFFB', text: '#4B2E8C' },
  dispatch_guide_generated: { bg: '#FCE8C4', text: '#8A5A0A' },
  dispatched: { bg: '#D3F3F0', text: '#0F6B63' },   
  facturado: { bg: '#D9F0DC', text: '#1F5C29' },  
}