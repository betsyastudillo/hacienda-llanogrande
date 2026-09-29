# Productos — Products / ProductForm

## `Products.jsx` — listado

- Muestra solo productos **base** (`!parent_product_id`) como filas principales; cada paquete asociado se muestra como una fila indentada justo debajo de su producto base (agrupados con `packsByParent`, un `reduce` sobre la lista completa).
- El stock se consulta por separado, solo para productos base, en paralelo (`Promise.all` sobre `GET /inventory/products/{id}/stock`) — los paquetes no tienen stock propio, usan el del producto base.
- **La columna de disponibilidad cambia según el rol:**
  - Con `inventory:ver` (roles internos): número exacto + ícono para ver el detalle de inventario.
  - Con `order:crear` pero sin `inventory:ver` (roles cliente): solo aparece un badge "Agotado" si `stock === 0`; si hay stock, no se muestra nada (para no saturar la tabla con un número que no necesitan).
- La columna de acciones (editar) solo aparece con `hasPermission('product:gestionar')`.

## `ProductForm.jsx` — crear/editar

- El tipo de producto (**producto base** vs. **paquete/presentación**) solo se puede elegir al **crear**. Al editar, el selector desaparece y se muestra una etiqueta informativa fija — cambiar el tipo de un producto ya existente puede dejar datos de inventario/paquetes inconsistentes, así que se bloqueó a propósito.
- Si es un paquete: se elige el producto base (`parent_product_id`) y `units_per_pack`. El campo `approx_weight_kg` puede dejarse vacío para que el backend lo calcule automático (`peso del padre × units_per_pack`); si se escribe un valor, ese gana siempre sobre el cálculo.
- Los valores `Numeric` que vienen del backend (`units_per_pack`, `approx_weight_kg`) se pasan por `Number()` antes de mostrarlos en los inputs, porque Postgres los devuelve con decimales fijos (ej. `"6.000"`) y sin esa conversión se ven feos en el formulario.

## Pesos aproximados por presentación (`UnitReferenceHelper`)

Los valores del panel de ayuda (cuánto pesa una canasta/bulto de cada fruta) son **estimaciones escritas a mano en el frontend**, no vienen de ninguna tabla. Son puramente informativos para quien llena el formulario de pedido — no afectan ningún cálculo real. Si se necesita que sean exactos y editables, habría que moverlos a un campo del backend (similar a `approx_weight_kg`).
