# Hacienda Llanogrande: sistema de pedidos y despacho

Boceto de ERP ligero para vender y despachar productos cosechados. Es una prueba técnica de la usuaria (Betsy), pero debe quedar como base real de producción. Responde y comenta el código en español. La interfaz está en español.

## Stack
- Backend (carpeta `Backend/`): FastAPI, Python 3.9, SQLAlchemy, Alembic, PostgreSQL en Neon. Se corre desde `Backend/` con el venv activo.
- Frontend (carpeta `Frontend/`): React con Vite, axios (`services/api.js`, exporta `API_BASE_URL`).
- Los archivos subidos viven en `Backend/uploads/` y se guardan como ruta relativa con "/" inicial.

## Flujo del pedido (order.status)
created -> payment_confirmed -> facturado -> transport_validated -> dispatch_guide_generated -> dispatched
- La proforma (payments) se numera PRO-AAAA-NNNN derivada del pedido PED-AAAA-NNNN.
- Al confirmar el pago se emite la factura (invoices) con un proveedor SIMULADO (`services/invoice_provider.py`). Todo dato DIAN lleva prefijo PRUEBA. No generes CUFE, QR o firmas que parezcan reales.
- El pedido pasa a `facturado` en la misma transacción.

## Convenciones del backend
- Los servicios lanzan `ValueError`; el router lo convierte en `HTTPException(400)` y hace `db.rollback()`. Toda excepción sin atrapar sale como "Network Error" en el navegador por CORS, así que atrápalas.
- Acceso a pedidos ajenos: responder 404, no 403 (no revelar que existe). Usa `can_access_order`.
- Permisos: `ROLES_PERMISSIONS` (admin tiene "*"). Dependencias en `auth_dependencies.py` con `require_permission` y `require_any_permission`. `user_has_permission` está en `app/dependencies.py`.
- Constantes de reglas de negocio en `app/constants/` (ese archivo no importa de services ni schemas, para evitar importaciones circulares).
- Todas las entidades heredan `AuditMixin`: llena `created_by_user_id` / `updated_by_user_id` con el usuario actual.
- Archivos sensibles (proforma, factura, comprobantes): descarga por endpoint con permisos, no por URL pública. Validar extensión y tamaño al subir.
- Los validadores Pydantic compartidos están en `CompanyValidators` (patrón mixin con `check_fields=False`).
- Los inventarios son inmutables: nunca borrar movimientos; se revierten con un movimiento nuevo.

## Reglas de migraciones (Alembic): importante
- NUNCA usar autogenerate para renombrar tablas o columnas (genera drop + create y pierde datos). Usar `op.rename_table` / `op.alter_column(new_column_name=...)`.
- NUNCA editar una migración ya aplicada: se crea una nueva.
- Guardar el archivo ANTES de correr `alembic upgrade head`. Si `upgrade` no imprime la línea "Running upgrade", Alembic marcó la versión sin ejecutar nada; se arregla con `alembic stamp <down_revision>` y volviendo a correr.
- Después de cada migración: `alembic check` debe decir "No new upgrade operations detected".
- Antes de crear una restricción única, buscar duplicados con SQL.

## Convenciones del frontend
- Patrón de tarjetas en `pages/OrderDetail/`: `PaymentCard.jsx` e `InvoiceCard.jsx` son la referencia (reciben `order` y el dato, y `onChanged` para recargar). Reutilizar sus clases `pay-*` y `detail-*` de `OrderDetail.css`.
- Avisos: `useToast()` de `context/Toast/ToastContext`, `showToast(mensaje, 'success' | 'error', duracionMs)`. Todo resultado de una acción y todo error de un botón va como toast; los errores de validación de campos pueden ir junto al formulario.
- Modales: `Modal` (render condicional con `&&`) y `ConfirmModal` (renderizar solo cuando se necesita, no siempre montado).
- Vista previa de archivos: `FilePreviewModal` (`fileUrl` para públicos, `apiPath` para los que exigen sesión).
- Estados con badge: `StatusBadge` con constantes en `constants/*Status.js`.
- No usar `crypto.randomUUID()` (la app se abre por IP desde el celular y no existe en contextos no seguros). Usar un contador o `Date.now()`.
- Los permisos se leen con `hasPermission('permiso')` de `AuthContext`.

## Cómo trabajar con Betsy
- Las pruebas son manuales: Swagger en `/docs`, consultas SQL en Neon y la interfaz. Al terminar cada pieza, dile exactamente cómo probarla.
- Antes de cambios grandes, propón el plan y espera confirmación. No hagas commits ni toques `.env` sin pedirlo.
- Si algo contradice este documento, avísale en vez de asumir.