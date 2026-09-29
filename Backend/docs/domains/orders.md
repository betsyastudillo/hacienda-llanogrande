# Pedidos y productos — Order, OrderItem, Product

## `Product` (antes `Material` — renombrado completo: tabla, clase, archivo, columnas)

Catálogo de lo que vende la hacienda. Campos clave: `price`, `tax_rate` (editable por producto, no un IVA global fijo), `unit` (`kg` | `tonelada` | `und` | `canasta` | `bulto`, validado contra `constants/units.py`), `approx_weight_kg` (referencia opcional, usada por paquetes para calcular su propio peso).

### Paquetes / presentaciones

Un producto puede ser un **paquete** de otro producto (`parent_product_id` + `units_per_pack`). No es una tabla aparte — es el mismo modelo `Product`, auto-referenciado (`relationship("Product", remote_side=[id], backref="packs")`).

- Un paquete **no puede** ser paquete de otro paquete (validado en `_validate_pack_fields`).
- `approx_weight_kg` de un paquete se calcula automático (`peso del padre × units_per_pack`) si se deja vacío al crear/editar; si se escribe un valor explícito, ese gana siempre — para permitir corregir cuando una cosecha específica pesó distinto al promedio.
- El inventario de un paquete **no existe por separado** — vive todo en el producto base (ver `inventory.md`).

## `Order` / `OrderItem`

Flujo de estados: `created → payment_confirmed → transport_validated → dispatch_guide_generated → dispatched → facturado`.

- `subtotal`/`tax`/`total` se calculan **siempre en el service**, nunca se confía en lo que mande el cliente — ni siquiera aunque el schema tenga esos campos.
- `company_id` se resuelve así: roles cliente usan `current_user.company_id` (se ignora cualquier valor que venga en el payload); `admin` puede especificar `company_id` explícito, para crear a nombre de otra empresa; ningún otro rol puede crear pedidos.
- `created_by_user_id` siempre viene de `current_user`, nunca del payload.
- Antes de agregar un item, se valida stock disponible con `get_sellable_stock()` (ver `inventory.md`) — si el producto es un paquete, la validación ya resuelve internamente cuánto stock base equivale.
- `can_access_order(order, current_user)` es la función de ownership reutilizada en Payment, Assignment y DispatchGuide para decidir si un rol cliente puede ver/actuar sobre un pedido específico.

### Pendiente conocido

`edit_order` borra físicamente los `InventoryMovement` de salida del pedido antes de recrearlos — contradice la regla de inmutabilidad del inventario. Debería reemplazarse por un movimiento de reversión explícito.
