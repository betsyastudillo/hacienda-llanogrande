# Inventario — Inventory / ProductInventory

Archivos en `pages/Products/Inventory/` (listado general) y `pages/Products/Inventory/ProductInventory/` (detalle por producto, anidado dentro de `Inventory/`) — viven bajo `Products/` porque el inventario es, conceptualmente, una vista sobre los productos, aunque tenga su propia ruta (`/inventory`) y su propio link en el sidebar.

Dos pantallas comparten el mismo modal de "Registrar movimiento" (componente `Modal`, ver `components.md`): `Inventory.jsx` (listado general, con selector de producto dentro del modal) y `ProductInventory.jsx` (detalle de un producto específico, el modal ya sabe a qué producto aplica).

## `Inventory.jsx` — listado general

Accesible desde el sidebar con `inventory:ver` (rol interno) — es la vista de gestión completa.

## `ProductInventory.jsx` — detalle de un producto

### Movimientos (modal "Nuevo movimiento")

- Tipo: `entrada` (cualquiera con `inventory:gestionar`) o `ajuste` (solo con `inventory:ajustar` — hoy, solo `admin`, vía el comodín `*`).
- Los ajustes exigen categoría (`ADJUSTMENT_CATEGORIES`) y motivo en texto libre. Las entradas no exigen motivo.
- **Los movimientos son inmutables.** No hay edición ni borrado en el frontend — si algo se registró mal, se corrige con otro movimiento (un ajuste), nunca modificando el original.

### Kardex

`GET /inventory/products/{id}/kardex?start_date=...&end_date=...` — saldo inicial, entradas, salidas, pérdida por daño, otros ajustes y saldo final del rango elegido. Por defecto carga el rango "hoy a hoy" al entrar a la pantalla, y se recalcula solo tras registrar un movimiento nuevo.

Como el cálculo es siempre en vivo sobre el historial completo (no hay "cierre de mes" en el backend), **cualquier rango de fechas pasado se puede consultar en cualquier momento** cambiando los dos inputs de fecha — no hace falta ninguna pantalla ni funcionalidad adicional para "ver meses anteriores".

### Historial de movimientos

Tabla con columnas de ancho fijo (`grid-template-columns`, no una `<table>` HTML) para que el texto largo del motivo no descuadre las demás columnas. En mobile, aparece scroll horizontal en vez de comprimir columnas (`min-width` en la fila + `overflow-x: auto` en el wrapper).

No es redundante con el kardex: el kardex da el resumen agregado del período; el historial da el detalle evento por evento (quién, cuándo, motivo exacto) — es el registro de auditoría, relevante justamente porque los movimientos no se pueden editar.
