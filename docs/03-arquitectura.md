# 03 · Arquitectura y convenciones

## 1. Vista de capas

```
Petición HTTP
   │
   ▼
routers/        ← valida permisos (Depends), llama al servicio, traduce ValueError → HTTP 400, hace rollback
   │
   ▼
services/       ← reglas de negocio; lanzan ValueError; usan models y constants
   │
   ▼
models/ ──► PostgreSQL        schemas/ = forma del JSON (entrada y salida)
constants/ = reglas fijas (no importa de services ni schemas, para evitar importaciones circulares)
```

Dependencias permitidas: `routers → services → models/constants`. Un servicio **no** importa de routers.
(Hay una excepción conocida: `services/assignment_service.py` importa `user_has_permission` de `app/dependencies.py`,
y `dependencies.py` importa `auth_service`/`user_service`. Funciona, pero es la zona donde aparecen los ciclos de importación.)

## 2. Ciclo de una petición (ejemplo: `POST /orders/`)

1. `main.py` registra el router de pedidos y el middleware CORS.
2. FastAPI ejecuta las dependencias del endpoint:
   `OrderCreator` → `require_permission("order:crear")` → `get_current_user` → decodifica el JWT, busca al usuario
   por `document_id`, verifica que esté activo y que su empresa no esté desactivada.
3. FastAPI valida el cuerpo con el schema `OrderCreate`.
4. El router llama `order_service.create_order(db, order, current_user)`.
5. El servicio valida (empresa aprobada y activa, productos activos, stock vendible), numera el pedido
   (`PED-2026-0001` con `order_counters`), calcula totales y hace `commit`.
6. Si el servicio lanzó `ValueError`, el router responde 400 con el mensaje.
7. La respuesta se serializa con `OrderResponse`.

## 3. Reglas y convenciones (obligatorias)

### 3.1 Errores
- Servicios: `raise ValueError("mensaje en español")`.
- Routers: `try / except ValueError → db.rollback(); raise HTTPException(400, detail=str(e))`.
- **Siempre** atrapar. Una excepción sin atrapar produce un "Network Error" engañoso en el navegador (CORS).
- Estado HTTP según el caso: 400 regla de negocio, 401 sin sesión, 403 sin permiso, 404 no existe **o no es tuyo**.

### 3.2 Acceso a recursos ajenos → 404
Si un cliente pide el pedido de otra empresa, se responde `404 Order not found`, no 403 (no revelar que existe).
Se usa `can_access_order(order, user)` ([order_service.py](../Backend/app/services/order_service.py)):
- `admin`, `soporte` → todo; `cliente_admin` → pedidos de su empresa; `cliente_operativo` → los que creó;
- cualquier otro rol (cartera, logística, operaciones, portería…) → `True` (el filtrado ya lo hizo el permiso del endpoint).

### 3.3 Permisos
- `ROLES_PERMISSIONS` en [constants/permissions.py](../Backend/app/constants/permissions.py) es la **fuente de verdad**.
- `require_permission(p)`: exige exactamente `p` (o `"*"`).
- `require_any_permission(*ps)`: exige al menos uno; luego el endpoint filtra según el alcance.
- `user_has_permission(user, p)`: devuelve `bool`, para lógica condicional dentro de una función.
- En `auth_dependencies.py` cada combinación es un tipo `Annotated` reutilizable (`PaymentConfirmer`, `OrderViewerAny`…).
  Para un permiso nuevo: (1) agregarlo a `ROLES_PERMISSIONS`, (2) crear su tipo en `auth_dependencies.py`, (3) usar el
  tipo en el endpoint, (4) si el frontend lo necesita, usarlo con `hasPermission('...')`.
- `constants/roles.py` y `require_role()` son **código legado**: no usar en código nuevo (ver [06](06-pendientes-y-decisiones.md)).

### 3.4 Auditoría (`AuditMixin`)
Todos los modelos (excepto `order_counters`) heredan [AuditMixin](../Backend/app/models/mixins.py), que añade
`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_by_user_id`.

> ⚠️ **Precisión importante:** el mixin solo **declara las columnas**. `created_at` lo llena la base de datos
> (`server_default=now()`) y `updated_at` se actualiza solo (`onupdate`). Pero `created_by_user_id` /
> `updated_by_user_id` **no se llenan automáticamente**: cada servicio los asigna a mano
> (`created_by_user_id=current_user.id`). No hay un listener de SQLAlchemy que lo haga. Hoy varios servicios los
> asignan y otros no (por ejemplo `carrier_service.create_carrier`, `bank_account_service`, `product_service`,
> `create_user`, `update_user`). `deleted_by_user_id` no lo usa nadie todavía. Ver [06](06-pendientes-y-decisiones.md).

### 3.5 Archivos subidos
- Viven en `Backend/uploads/` y en la base se guardan como **ruta relativa con "/" inicial**
  (`/uploads/receipts/<payment_id>/<uuid>.pdf`). Para abrirlos desde el disco se hace `.lstrip("/")`.
- Subcarpetas: `documents/<dueño>/`, `receipts/<payment>/`, `proformas/<payment>/`, `invoices/<invoice>/`,
  `dispatch_guides/<assignment>/qr.png`.
- **Archivos sensibles** (proforma, factura, comprobantes, documentos de transporte) se descargan por un endpoint con
  permisos, **no** por la URL pública. Ojo: `main.py` monta `/uploads` como estático público, así que *cualquiera con la
  URL exacta* puede abrir un archivo. Las rutas incluyen UUID aleatorios (difíciles de adivinar), pero la regla de
  negocio "no por URL pública" no se cumple del todo mientras ese montaje exista ([06](06-pendientes-y-decisiones.md)).
- Validación al subir: extensión (`.pdf .jpg .jpeg .png .webp`) y tamaño (5 MB comprobantes/transporte, 10 MB constante de facturas).
  `document_service.save_document_file` (documentos de empresa) **no valida** extensión ni tamaño.
- Al reemplazar un archivo, el viejo se borra **después** del `commit`.

### 3.6 Inventario inmutable
Nunca se borra un `InventoryMovement`. Los errores se corrigen con un `ajuste` (puede ser negativo). No existe endpoint
de edición ni borrado de movimientos.

### 3.7 Borrado lógico
No se borra información de negocio: se usa `is_active` (empresas, usuarios, productos, cuentas, transportadores, tipos
de vehículo, lista negra) o campos de anulación (`cancelled_at` en pedidos/retiros). Excepciones de borrado real:
`edit_order` borra y recrea `order_items` (solo en `created`), `validate_assignment` y `complete_post_review` reemplazan
los `transport_checks` del retiro.

### 3.8 Precios congelados
`orders.subtotal/tax/total` y `order_items.unit_price/subtotal` se guardan al vender. Cambiar el precio de un producto
no altera pedidos existentes. La factura copia esos valores.

### 3.9 Validadores Pydantic compartidos
`CompanyValidators` ([schemas/company.py](../Backend/app/schemas/company.py)) es un *mixin* con `field_validator(...,
check_fields=False)` que valida teléfono, correo, CIIU, ciudad, dirección, etc. Lo heredan `CompanyCreate` y `CompanyUpdate`.
`check_fields=False` permite declarar validadores para campos que la clase base no define.

### 3.10 Numeración
- Pedido: `PED-AAAA-NNNN`, con año en hora Colombia (UTC−5), usando un `INSERT … ON CONFLICT DO UPDATE` atómico sobre `order_counters`.
- Proforma: `PRO-AAAA-NNNN` = el número del pedido cambiando el prefijo.
- Empresa: `CLI-NNNN` (clientes) o `HAC-NNNN` (la propia) — `generate_client_code` toma el máximo + 1 (no es seguro ante concurrencia; hay manejo de `IntegrityError`).
- Factura (simulada): hoy `invoice_number = order_number`.

### 3.11 Zona horaria
La base guarda fechas con zona (UTC). Los cortes de día y los PDF usan `America/Bogota`. Hay un par de lugares que usan
`datetime.utcnow()` sin zona (`payments.confirmed_at`, `receipt_uploaded_at`).

## 4. Reglas de negocio de transporte (`constants/transport_requirements.py`)

| Concepto | Valor |
|----------|-------|
| Documentos obligatorios del vehículo | `soat`, `tarjeta_propiedad` |
| Documento del dueño | `documento_propietario` (solo si el dueño **no** es el transportador) |
| Documentos del transportador | `cedula`, `licencia_conduccion` |
| Documentos que vencen | `soat` (vehículo), `licencia_conduccion` (transportador); exigen `expires_at` |
| Vigencia mínima / máxima | 0 días de margen; máx. 10 años (evita `2206`) |
| Consultas obligatorias | vehículo: `simit`; dueño: `listas_vinculantes`, `simit`; transportador: `listas_vinculantes`, `antecedentes_judiciales`, `simit` |
| Consultas que bloquean la aprobación si tienen hallazgo | `listas_vinculantes` |
| Estados del retiro donde el cliente aún puede subir documentos | `pending`, `rejected` |
| Archivos | `.pdf .jpg .jpeg .png .webp`, máx. 5 MB |
| Placa | 5–6 caracteres alfanuméricos, se normaliza a mayúsculas sin guiones |

Un documento **rechazado o vencido cuenta como faltante** (`compute_missing_documents`).
Si el dueño del vehículo tiene el mismo documento que el transportador, no se piden ni el documento del dueño ni la
consulta del dueño (`is_owner_carrier`).

## 5. Reglas de negocio de empresas (`constants/company_requirements.py`)

- Documentos requeridos: **jurídica** → cámara de comercio, RUT, cédula del representante; **natural** → cédula, RUT.
- Consultas comunes: listas vinculantes, antecedentes judiciales, inspektor, datacrédito, cifin. Extra por sector:
  `construccion` → `dian_proveedores_ficticios`; `agro` → `contrabando`. Al representante legal solo le aplican las comunes.
- Campos editables tras crear: lista blanca `EDITABLE_FIELDS` (no se puede cambiar documento, razón social, tipo de
  persona ni sector). Cambiar la identidad del representante legal obliga a repetir sus consultas.

## 6. Frontend: patrones

Ver [Frontend/docs/README.md](../Frontend/docs/README.md). Resumen de las reglas de `CLAUDE.md`:

- Tarjetas del detalle de pedido: `PaymentCard` e `InvoiceCard` son la referencia (reciben `order`, el dato y `onChanged`).
- Avisos: `useToast()` → `showToast(mensaje, 'success' | 'error', duracionMs)`. Todo resultado de una acción y todo
  error de botón va en toast; los errores de campo pueden ir junto al formulario.
- Modales: `Modal` (render condicional con `&&`) y `ConfirmModal` (montarlo solo cuando se necesita).
- Vista previa: `FilePreviewModal` (`fileUrl` público, `apiPath` para archivos que exigen sesión).
- **No usar `crypto.randomUUID()`**: la app se abre por IP desde el celular (contexto no seguro, no existe). Usar contador o `Date.now()`.
- Permisos en pantalla: `hasPermission('permiso')`.

## 7. Seguridad: resumen y límites

- Contraseñas con bcrypt; JWT HS256 firmado con `JWT_SECRET_KEY` (30 min por defecto).
- El token incluye `sub` (documento), `role` y `company_id`, pero **el backend ignora `role`/`company_id` del token** y
  vuelve a leer al usuario de la base en cada petición (así un cambio de rol o una desactivación aplica de inmediato).
- Rutas de verificación de guía exigen sesión de portería (o admin). El QR solo contiene un token aleatorio de 32 bytes.
- `register` y gestión de usuarios: solo `user:gestionar` (admin).
- No hay límite de intentos de login ni expiración de contraseñas.
