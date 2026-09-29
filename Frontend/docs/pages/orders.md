# Pedidos — Orders / OrderNew / OrderDetail

## `Orders.jsx` — listado

`GET /orders/` — el backend ya filtra según el rol (ver `order_service.py` en el backend): roles internos ven todos, `cliente_admin` ve los de su empresa, `cliente_operativo` ve solo los que creó.

- Buscador (`SearchInput`) filtra en memoria por ID, `company_display_name` o estado — no dispara peticiones nuevas.
- Botón "Crear pedido" visible solo con `hasPermission('order:crear')`.
- `company_display_name` viene resuelto desde el backend (`computed_field` en `OrderResponse`, usa `display_name` de la empresa si existe, si no `legal_name`) — el frontend no arma ese nombre por su cuenta.

## `OrderNew.jsx` — crear pedido

- Si el usuario es `admin`, aparece un selector de empresa (`GET /companies/?company_type=client`) porque solo admin puede crear a nombre de otra empresa; los roles cliente no ven ese campo — el backend usa `current_user.company_id` automáticamente para ellos.
- El selector de producto solo muestra productos con stock disponible (`GET /inventory/products/{id}/stock` por cada uno, en paralelo con `Promise.all`). Si un producto llega a 0, desaparece de la lista en vez de mostrarse deshabilitado.
- Al elegir un producto, se muestra su unidad y el stock disponible como referencia.
- Las cantidades son siempre enteras (`step="1"`, validación `Number.isInteger`) — el backend no acepta decimales en `quantity_m3` desde el pivote a venta por unidades/peso.
- El peso aproximado por línea usa `estimateWeightKg()` (ver `constants.md`) — es solo informativo, no se envía al backend ni afecta el cálculo real de subtotal/impuestos (eso lo hace el servicio, siempre desde `Product.price`/`tax_rate`, nunca confiando en el frontend).
- Los ítems se pueden editar antes de enviar el pedido: "Editar" carga la fila en el formulario de arriba y el botón cambia a "Guardar", reemplazando esa posición en el array en vez de duplicarla.
- Al enviar, `POST /orders/` — si tiene éxito, navega a `/orders/{id}` (el detalle).

## `OrderDetail.jsx` — detalle

Carga en paralelo: el pedido, la lista de productos (para resolver nombres, ya que `OrderItemResponse` solo trae `product_id`), y — cada una con su propio try/catch independiente, porque un 404 ahí es normal, no un error — el pago, la asignación de transporte y la guía de despacho asociados.

- **Stepper de estado** (`StatusStepper`, definido dentro del propio archivo): la línea de progreso es un elemento de fondo separado de los círculos, para que las etiquetas queden centradas bajo cada paso sin que la línea empuje el centrado (ver nota si se cambia la cantidad de pasos: el `left`/`right` del `.detail-stepper-track` está calculado para 6 pasos exactos — `(100/N)/2`).
- **Sección de Pago**: referencia (proforma_number), badge de estado con ícono (`PAYMENT_STATUS_CONFIG`), y datos de la cuenta bancaria si `payment.bank_account_id` está resuelto.
- **Sección de Transporte**: badge de `validation_status` (`ASSIGNMENT_STATUS_CONFIG`), y motivo de rechazo si aplica.
- **Sección de Guía de despacho**: imagen del QR, cargada con la URL completa (`API_BASE_URL` + `qr_image_url`, porque el backend solo devuelve la ruta relativa — ver `services/api.md` si existe, o `README.md` de este mismo directorio).
- Esta pantalla es **solo lectura** por ahora — no tiene botones para confirmar pago ni validar transporte. Esas acciones se hacen hoy desde Swagger/el backend directamente; construir los botones aquí es un pendiente.
