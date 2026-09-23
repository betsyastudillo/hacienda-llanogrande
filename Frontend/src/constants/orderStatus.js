export const ORDER_STATUS_STEPS = [
  { key: 'created', label: 'Creado' },
  { key: 'payment_confirmed', label: 'Pago confirmado' },
  { key: 'transport_validated', label: 'Transporte validado' },
  { key: 'dispatch_guide_generated', label: 'Guía generada' },
  { key: 'dispatched', label: 'Despachado' },
  { key: 'facturado', label: 'Facturado' },
]

export const STATUS_LABELS = Object.fromEntries(
  ORDER_STATUS_STEPS.map((step) => [step.key, step.label])
)