# Detalle del pedido y sus tarjetas

La pantalla [OrderDetail.jsx](../src/pages/Orders/OrderDetail/OrderDetail.jsx) (`/orders/:orderId`) es la más importante
del sistema: reúne el estado del pedido, los productos y las tres tarjetas que cubren el ciclo de cobro y despacho.
Clases CSS compartidas en `OrderDetail.css`: prefijos `detail-*` (estructura) y `pay-*` (tarjetas).

## Estructura

```
OrderDetail
 ├─ StatusStepper            ← barra de pasos (ORDER_STATUS_STEPS); un pedido anulado muestra "Creado → Anulado"
 ├─ Datos del pedido + tabla de productos (cantidad, pendiente por retirar, despachada)
 ├─ Botones: Editar (order:editar_propio, estado created, sin pago) · Anular (order:anular, estado created)
 ├─ <PaymentCard/>           ← proforma y comprobante
 ├─ <InvoiceCard/>           ← factura (solo lectura)
 └─ <TransportCard/> × N     ← una por retiro, más una "Nuevo retiro" si queda saldo por programar
```

Carga de datos (`reloadAll`): `GET /orders/{id}` y en paralelo pago, factura y retiros (`fetchPayment`, `fetchInvoice`,
`fetchAssignments`). Los 404 de pago/factura son normales ("aún no existe") y se atrapan. Las tarjetas reciben `onChanged`
(= `reloadAll`) y lo llaman después de cada acción.

Reglas de visibilidad en `OrderDetail`:
- `canEdit` = `order:editar_propio` + estado `created` + sin pago.
- `canCancel` = `order:anular` + estado `created`.
- `showNewWithdrawal` = estado `facturado/partially_dispatched` + hay cantidad pendiente por programar + (no hay retiros aún **o** el usuario puede programar: tiene `assignment:crear_propio` y no `assignment:validar`).
- Cada tarjeta recibe `defaultOpen` para abrirse sola cuando es la que requiere atención (pago abierto en `created`; el retiro activo abierto en fase de retiros).

## `PaymentCard` — referencia del patrón de tarjetas
Props: `order`, `payment`, `bankAccount`, `onChanged`, `defaultOpen`.
- Sin pago y con `payment:crear|crear_propio`: elige cuenta bancaria (`GET /bank-accounts/`) y **genera la proforma** (`POST /payments/`).
- Con pago: vista previa de la proforma (`FilePreviewModal` con `apiPath`), subida del comprobante (`payment:subir_comprobante`, `POST /payments/{id}/receipt`) y vista previa del comprobante.
- Con `payment:confirmar` y comprobante subido: botones **Confirmar** y **Rechazar** (con motivo) → `POST /payments/{id}/confirm`.
- Mensajes: todo resultado/error va con `showToast`.

## `InvoiceCard`
Props: `order`, `invoice`, `defaultOpen`. Solo lectura: muestra el número y la fecha de emisión, y el botón **Ver factura**
(`FilePreviewModal` con `apiPath=/invoices/{id}/pdf`). Sin factura: "Se emitirá una vez se confirme el pago." (pedido
`created`) o "Este pedido no tiene factura registrada." Hay bloques comentados (total y leyenda "Simulación (sin validez fiscal)")
que se pueden reactivar.

## `TransportCard` (≈1.400 líneas)
Props: `order`, `assignment` (o `undefined` para "Nuevo retiro"), `products`, `onChanged`, `defaultOpen`.

Qué puede hacer cada rol (derivado de los permisos del usuario y del estado del retiro):

| Booleano | Condición | Habilita |
|---|---|---|
| `canSubmit` | `assignment:crear_propio` y **no** `assignment:validar` | El cliente programa un retiro y sube documentos |
| `canFix` | `canSubmit` + retiro abierto + `pending/rejected` | Corregir y reenviar datos (`PUT …/resubmit`) |
| `canUpload` | `canSubmit` + abierto + no aprobado | Subir/reemplazar documentos |
| `canDecide` | `assignment:validar` + abierto + `pending` | Revisar documentos, **Verificar y aprobar**, **Rechazar** |
| `canMakeGuide` | `dispatch_guide:crear` + abierto + `approved` + sin guía | **Generar guía** (`POST /dispatch-guides/`) |
| `canCorrect` | `assignment:corregir` + abierto | **Corregir** quién recoge (`PUT …/correct`) |
| `canCancel` | `canCorrect` + guía no `in_plant` | **Anular retiro** (`POST …/cancel`) |

"Abierto" (`isOpen`) = existe el retiro, no está anulado, el pedido está en fase de retiros y su guía no está `used`.

Componentes internos:
- **Formulario de retiro** (modal): cantidades por producto (con sugerencia de vehículo según peso y `capacity_kg` del tipo), datos del vehículo, del dueño y del transportador, con ayudas de autocompletado (`lookupVehicle`, `lookupOwner`, `lookupCarrier`) que avisan si algo está vetado (`blocked`). Casilla "el dueño es el transportador" (`ownerIsCarrier`).
- **`TransportDocuments`**: tabla de documentos requeridos con su estado (`Falta | En revisión | Aprobado | Rechazado | Vencido`), subir/reemplazar (pide fecha de vencimiento para SOAT y licencia), vista previa por `apiPath` (`/assignments/{id}/documents/{doc}/file`), y aprobar/rechazar para Logística.
- **Modal "Verificar y aprobar transporte"**: lista las consultas obligatorias por sujeto (`vehicle`, `owner`, `carrier`) para marcar "sin hallazgos" o "con hallazgos + nota", construidas con la lista que entrega el backend (`required_checks`). Tras un cambio de transporte ya aprobado reutiliza el mismo modal como "Registrar consultas del cambio" (`complete-review`).
- **Modal "Rechazar transporte"**: motivo + casillas para vetar transportador / vehículo / dueño.
- **Modal "Anular retiro"**: motivo obligatorio.
- Muestra la **guía** (estado, QR) y un resumen en el título: `Sin programar | Pendiente de validación | Aprobado | Rechazado | Guía generada | En planta | Despachado | Anulado`.

El estado `busy` evita doble clic; `run(name, action, okMessage, errorMessage, after)` es el envoltorio común que llama a la API,
muestra el toast y recarga.

## `VerifyGuide` y `ScanGuide` (portería)
- `ScanGuide` (`/dispatch-guides/scan`): abre la cámara trasera con `Html5Qrcode`; extrae el token del enlace del QR
  (`/dispatch-guides/verify/<token>`) o de un código pegado a mano y navega a `/dispatch-guides/verify/<token>`.
  Requiere HTTPS o `localhost` para la cámara en la mayoría de navegadores; si no, queda el campo manual.
- `VerifyGuide`: `GET /dispatch-guides/verify/{token}` y muestra pedido, retiro, origen/destino, carga, saldo, vehículo,
  transportador y estado. Aviso si `blocked`. Botón **Registrar ingreso** si `can_enter`; **Registrar salida** si `can_exit`
  (`POST …/entry|exit`). La salida descuenta el inventario en el backend.

## `OrderNew` (crear/editar pedido)
Formulario con productos del catálogo (`GET /products/`); muestra solo los que tienen stock vendible
(`GET /inventory/products/{id}/stock` → `current_stock`) y valida en pantalla que la cantidad no lo supere. En modo edición
(`/orders/:orderId/edit`) carga el pedido y le suma de vuelta el stock que ese mismo pedido ya reservaba. El backend
recalcula todo y es la referencia.

## `Orders` (listado)
Búsqueda (por número de pedido, nombre de empresa o etiqueta de estado), conmutador **"Pendientes primero"** (ordena por `needs_action`), contador "N requieren atención",
casilla para ver anulados, `StatusBadge` por estado y popover de ayuda de estados (`StatusHelpPopover`).
