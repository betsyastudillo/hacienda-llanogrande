# Inventario — InventoryMovement

## Diseño: historial inmutable, saldo siempre calculado

No existe un campo "stock actual" guardado en `Product`. El stock es siempre la suma de `InventoryMovement` de ese producto (`entrada − salida + ajuste`). No hay endpoint de editar ni borrar un movimiento — una corrección se hace registrando un movimiento nuevo, nunca modificando uno existente. Esta regla es intencional y viene directo de un requerimiento de negocio (control interno necesita poder confiar en que el historial no se manipula retroactivamente).

## Paquetes y stock compartido

Un paquete (`Product.parent_product_id` no nulo) no tiene inventario propio. `resolve_stock_target(product)` devuelve el producto base cuando corresponde; `get_deduction_quantity()` convierte "cuántos paquetes pidió el cliente" a "cuánto descontar del producto base" (`quantity × units_per_pack`), y valida que el resultado sea un entero exacto — si `units_per_pack` produjera una fracción de unidad, lanza error en vez de descontar un número inválido.

`get_sellable_stock(db, product)` es la función que de verdad importa consultar desde fuera de este módulo: ya resuelve paquete-vs-base y hace el redondeo hacia abajo correspondiente (no se puede vender medio paquete).

## Ajustes — categoría obligatoria

`movement_type: "ajuste"` exige `category` (`damage` | `count_difference` | `other`) y `reason` en texto libre. La categoría `damage` guarda automáticamente la cantidad como negativa (el usuario escribe cuántas unidades se dañaron como número positivo; el service la convierte a pérdida). Solo quien tiene el permiso `inventory:ajustar` (hoy, únicamente `admin`, vía el comodín) puede registrar un ajuste — `entrada` está disponible para cualquiera con `inventory:gestionar`.

## Kardex

`get_kardex(db, product_id, start_date, end_date)` — saldo inicial + entradas + salidas + ajustes (desglosados en daño vs. otros) + saldo final, para cualquier rango de fechas. Los cortes de día se calculan en hora de Colombia (`zoneinfo`, `America/Bogota`), no en UTC — importante porque `created_at` se guarda en UTC en la base de datos.

Como el cálculo es siempre en vivo sobre el historial completo, **no existe ni hace falta un "cierre de mes"** — cualquier período pasado se puede consultar en cualquier momento, sin necesidad de haber "archivado" nada antes. Si en el futuro se requiere bloquear formalmente un período (para que nadie registre movimientos retroactivos una vez cerrado), sería una funcionalidad nueva, no algo que falte para que el kardex funcione hoy.

## Pendiente (Fases 2 y 3, sin construir)

- Conciliación diaria: control interno cuenta las entradas del día, reporta OK / OK-con-daño / diferencia. El saldo **no** se autoajusta — una diferencia queda como alerta para que `admin` decida.
- Rol "control interno" — no existe todavía en `ROLES_PERMISSIONS`.
- Sistema de alertas para `admin` al iniciar sesión.
- `audit_log` completo — el `AuditMixin` cubre "quién creó/tocó por última vez", no un historial detallado de cada cambio de valor. Este módulo es el candidato más probable para finalmente justificarlo.
