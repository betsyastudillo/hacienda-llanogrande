# Backend — Hacienda Llanogrande

Documentación técnica del backend. Para instrucciones de instalación y variables de entorno, ver el `README.md` de la raíz del repositorio.

## Stack

- FastAPI (Python 3.9)
- PostgreSQL en Neon, vía SQLAlchemy
- Alembic — migraciones
- Pydantic v2 — schemas

## Arquitectura en capas

```
app/
  models/       Tablas (SQLAlchemy) — solo estructura de datos, sin lógica de negocio
  schemas/       Forma de entrada/salida de la API (Pydantic) — separa "lo que guardo" de "lo que expongo"
  services/      Lógica de negocio real: cálculos, validaciones, reglas
  routers/        Endpoints — reciben la petición, verifican permisos, delegan al service
  constants/       roles.py (legado), permissions.py (fuente de verdad actual), units.py
  dependencies.py   get_current_user, require_role (legado), require_permission, require_any_permission, user_has_permission
  auth_dependencies.py   Tipos Annotated reutilizables por permiso (ver permissions.md)
  main.py           Registro de routers, CORS
```

Un router nunca debería tener lógica de negocio propia; un model nunca debería decidir permisos; un service nunca debería saber nada de HTTP.

## Convenciones del proyecto

- **Python 3.9**: `Optional[X]`, nunca `X | None`.
- **Nombres**: clases y archivos en singular e inglés (`Product`, `product.py`), tablas en plural (`products`), excepto `nit` (término legal colombiano, se deja igual en ambos idiomas).
- **Nunca mass assignment** en campos sensibles (`role`, `company_id`, `verification_status`, `is_active`, `parent_product_id`, etc.) — siempre asignación campo por campo, explícita, en el service. Nunca `Model(**data.dict())` cuando el schema toca algo sensible.
- **Migraciones — dos pasos siempre**: cambiar el modelo Python nunca alcanza por sí solo. Falta generar (`alembic revision --autogenerate`) y aplicar (`alembic upgrade head`). Olvidar el segundo paso es la causa más común de errores "columna no existe" / `UndefinedTable` en este proyecto — pasó varias veces durante el desarrollo.
- **Renombrar tabla o columna**: el autogenerate de Alembic **no detecta renombres**, genera `drop` + `create` (pierde datos). Los renombres se escriben a mano con `op.rename_table(...)` / `op.alter_column(..., new_column_name=...)`. Ver el historial de migraciones para ejemplos reales (`materials` → `products`).
- **Soft delete**: todas las entidades usan `is_active` (boolean), nunca borrado real.
- **`AuditMixin`** (`models/mixins.py`): toda entidad lo hereda. Da `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_by_user_id` automáticamente — nunca se declaran a mano en un modelo nuevo.
- **Timestamps de negocio específicos no van en el mixin.** `updated_at` se sobreescribe con cualquier cambio; si necesitas saber "¿cuándo se *confirmó* el pago?" o "¿cuándo se *validó* el transporte?", eso es una columna propia (`confirmed_at`, `validated_at`), porque una edición no relacionada no debe borrar ese dato.
- **Snapshot de precios**: `Order.subtotal/tax/total` y `OrderItem.unit_price/subtotal` se calculan y guardan en el momento de la venta, nunca se recalculan dinámicamente — si el precio del producto cambia después, los pedidos históricos no deben cambiar con él. Es intencional, no un dato duplicado por error.
- **Cantidades siempre enteras**: `OrderItem.quantity_m3` e `InventoryMovement.quantity` son `Integer`, no `Numeric` — decisión tomada al pivotar del negocio de áridos (que se vendían por volumen fraccionario) a productos agrícolas (que se compran/cosechan en unidades enteras).
- **Movimientos de inventario son inmutables**: no hay endpoint de editar ni borrar un `InventoryMovement`. Una corrección siempre es un movimiento nuevo (`ajuste`), nunca una edición del original.

## Pendientes conocidos

- `Invoice` — en pausa, preguntas de negocio sin resolver con el dueño (numeración, momento de generación, recálculo de impuestos).
- `audit_log` completo (historial detallado con snapshot antes/después) — se decidió posponer varias veces; el módulo de inventario es probablemente el que finalmente lo justifique.
- PDF real de la proforma de pago — el campo `Payment.pdf_url` existe, la generación del archivo no está construida.
- `create_dispatch_guide` no valida hoy que `Assignment.validation_status == "approved"` antes de generar la guía — solo revisa que exista una asignación. Es un hueco real pendiente de cerrar.
- Conciliación diaria de inventario, rol de "control interno", alertas al admin — Fase 2/3 del módulo de inventario, sin construir.
- Reversión de movimientos de inventario al editar un pedido (`edit_order` hoy borra físicamente los movimientos de salida viejos antes de recrearlos — contradice la regla de inmutabilidad; falta reemplazar por un movimiento de reversión).
