# 06 · Pendientes, errores conocidos y decisiones

> Este documento sale de **leer el código completo** (a 2026-11-06) y de las pruebas manuales hechas ese mismo día
> (retiros parciales con arena en m³, QR de portería con entrada y salida). Los puntos marcados como error se dejaron
> como estaban para que quien reciba el proyecto decida. Cada punto indica el archivo y qué hacer. Los más
> importantes van primero.
>
> (ahí está la conversión del IVA, ver 3.5).

## 1. Errores confirmados (corregir cuanto antes)

| # | Dónde | Qué pasa | Cómo arreglarlo |
|---|-------|----------|-----------------|
| 1 | [dispatch_guide_service.py `build_balance_detail`](../Backend/app/services/dispatch_guide_service.py) | El `if not parts: return …` y el `return "Saldo pendiente…"` están **dentro del `for`** (error de sangría). Solo se evalúa el **primer** producto del pedido: si ya está completo devuelve "Sin saldo: con este retiro se completa el pedido" aunque falten otros; si no, lista solo ese producto. El texto sale impreso en la guía. | Sacar ambos `if/return` del ciclo (un nivel menos de sangría) y probar con un pedido de dos productos. |
| 2 | [App.jsx](../Frontend/src/App.jsx) ruta `/link-login` | Está dentro del grupo `ProtectedRoute`: quien llega por *magic link* aún no tiene sesión y es redirigido a `/login`. El enlace nunca puede funcionar sin sesión previa. | Sacar `/link-login` del grupo protegido, junto a `/login`. |
| 3 | [assignment_service.py `create_assignment`](../Backend/app/services/assignment_service.py) | El comentario dice "`with_for_update` bloquea el pedido…" pero **no se usa** ningún bloqueo. Dos retiros simultáneos pueden pasarse de la cantidad pendiente. | `db.query(Order).filter(...).with_for_update().first()`. |
| 4 | [order_service.py `create_order` / `edit_order`](../Backend/app/services/order_service.py) | Sin bloqueo: dos pedidos simultáneos pueden vender el mismo stock (sobreventa). | Bloquear la fila del producto base durante la validación, o validar con restricción en BD. |
| 5 | [routers/order.py `update_order`](../Backend/app/routers/order.py) | `edit_order` lanza `PermissionError` para pedidos ajenos y el router responde **403**, contradiciendo la regla de "404 para ajenos". Además `OrderCreator` no es lo mismo que `OrderEditorOwn` (permiso definido pero sin usar). | Responder 404; evaluar usar `order:editar_propio`. |
| 6 | [routers/auth.py `register_user`](../Backend/app/routers/auth.py) | No atrapa errores: un `document_id` o `email` duplicado lanza `IntegrityError` → 500 → "Network Error". Tampoco valida que `role` sea válido ni que la empresa exista. | `try/except` + validar contra `ROLES_PERMISSIONS`. |
| 7 | [vehicle_service.create_vehicle / edit_vehicle](../Backend/app/services/vehicle_service.py) | `VehicleCreate` exige los datos del dueño pero el servicio solo guarda `type` y `plate` (los demás se pierden), y no normaliza la placa. Los endpoints `/vehicles` no se usan desde la interfaz (los vehículos nacen al registrar un retiro). | Actualizar el servicio o retirar los endpoints. |
| 8 | [Backend/docs/README.md](../Backend/docs/README.md) (versión anterior) | Su lista de "Pendientes" afirmaba cosas ya resueltas (PDF de proforma sí existe; `create_dispatch_guide` sí valida que el retiro esté aprobado; `edit_order` ya no toca movimientos). | Reemplazada en esta documentación. |
| 9 | [validate_assignment](../Backend/app/services/assignment_service.py) (≈ líneas 675-681) | La comprobación de hallazgo bloqueante está duplicada (dos `if` idénticos). Inocuo. | Borrar uno. |

## 2. Lugares donde el código no cumple lo que dicen `CLAUDE.md` / documentación

| Regla documentada | Realidad |
|---|---|
| Flujo de estados `created → payment_confirmed → facturado → transport_validated → dispatch_guide_generated → dispatched` (CLAUDE.md) | Los estados `transport_validated` y `dispatch_guide_generated` **ya no existen** como estado del pedido (ahora son estados del retiro/guía). El flujo real es `created → (payment_confirmed) → facturado → partially_dispatched → dispatched` (+ `cancelled`). Ver [02](02-flujo-del-pedido.md). **Actualizar CLAUDE.md.** |
| "Todas las entidades heredan `AuditMixin`: llena `created_by_user_id` / `updated_by_user_id` con el usuario actual" | El mixin solo declara columnas. Los servicios lo hacen a mano y **no todos**: faltan en `create_carrier`/`edit_carrier`/`deactivate_carrier`, todo `bank_account_service`, todo `product_service`, `create_user`/`update_user`/`deactivate_user`/`change_password`, `document_blacklist_service.blacklist_document` y `remove_from_blacklist`, `update_document_status` (sí lo asigna, pero falla con `current_user=None`), `create_payment`, `confirm_payment`, `upload_receipt` y la factura. Opción: un `event.listens_for(Session, "before_flush")` con el usuario actual en un `ContextVar`. |
| "Archivos sensibles: descarga por endpoint con permisos, no por URL pública" | Existen los endpoints con permisos, **pero** `main.py` monta `app.mount("/uploads", StaticFiles(...))` y expone todo `uploads/` públicamente. Quitar el montaje (hoy `qr_image_url`, la vista previa del frontend por `fileUrl` y los documentos de empresa dependen de él: habría que migrarlos a endpoints). |
| "Validar extensión y tamaño al subir" | Se valida en comprobantes y documentos de transporte. **No** en documentos de empresa (`document_service.save_document_file`). En `invoice_service.py` hay constantes (`INVOICES_DIR`, `MAX_SIZE`) e imports sin usar. |
| "Los inventarios son inmutables" | Se cumple (no hay edición ni borrado de movimientos). |
| "`user_has_permission` está en `app/dependencies.py`" | Cierto; además `assignment_service` importa desde allí, lo que acopla servicios con la capa de dependencias de FastAPI. |
| "Toda excepción sin atrapar sale como Network Error: atrápalas" | Hay endpoints sin `try/except`: `register_user`, `routers/document.py` (subir/reemplazar, `create_document` puede lanzar `ValueError`), `routers/carrier.py`/`vehicle.py` al subir documentos. |
| "El pedido pasa a `facturado` en la misma transacción" | Cierto (`confirm_payment`). |
| README anterior: `POST /payments/webhook`, `seed_admin.py`, `require_role()` "aplicada en todos los routers" | El webhook y `seed_admin.py` no existen; los routers usan permisos, no `require_role`. |

## 3. Deuda técnica y mejoras sugeridas

### 3.1 Código del dominio anterior (áridos) que conviene limpiar
- `order_items.quantity_m3`: significa "cantidad en la unidad del producto". Hoy es **entero**, lo que impide vender m³ fraccionarios (por ejemplo 12,5 m³ de arena). Renombrarlo a `quantity` y pasarlo a `Numeric` son dos cambios que conviene hacer **en una sola migración, a mano** (`op.alter_column(..., new_column_name='quantity', type_=...)`, nunca autogenerate) y ajustar schemas, servicios (inventario, retiros, `AssignmentItem.quantity`) y frontend.
- `constants/roles.py` y `require_role()`: legado sin uso real. Además `CAN_VIEW_PAYMENTS_ALL`, `CAN_VIEW_DISPATCH_GUIDES` y `CAN_VIEW_BANKS_ACCOUNTS` contienen una tupla dentro de otra tupla (`(ADMIN, …, CLIENT_ROLES)`), por lo que la comprobación `rol in …` nunca es verdadera para clientes. Solo `routers/dispatch_guide.py` aún importa de ahí (`CAN_MANAGE_FLEET` sin usar, `CAN_VIEW_DISPATCH_GUIDES`). Migrar a permisos y borrar el archivo.
- Sector `construccion` y su consulta `dian_proveedores_ficticios`: confirmar con el negocio si siguen vigentes. (La unidad `m3` y la capacidad por tipo de vehículo **sí** están vigentes: se usan para material de arrastre.)
- `services/transport_service.py` está vacío (0 líneas). Borrarlo o usarlo.
- `schemas/payment.py` tiene `PaymentInitiateRequest` (resto del webhook). `config.payment_webhook_secret` es obligatoria pero no se usa.

### 3.2 Facturación
- `SimulatedProvider.emit` (`invoice_provider.py`) es el único punto a reemplazar: crear `FacturatechProvider` (u otro) con el mismo método `emit(order, invoice) -> ProviderResult` y devolverlo en `get_provider()`.
- No se genera XML (`invoices.xml_url` siempre nulo; el endpoint `GET /invoices/{id}/xml` siempre responde 404).
- `invoice_number` copia el número de pedido. Falta definir el formato real y su consecutivo.
- El PDF fija `SELLER_TAX_REGIME = "No responsable de IVA"` mientras los pedidos calculan IVA. Inconsistencia de negocio por resolver.
- La marca de agua diagonal "SIMULACIÓN" (`_watermark` en `invoice_pdf.py`) está **comentada** al construir el PDF (`doc.build(story, # onFirstPage=…)`). El texto de simulación del pie sí aparece. Reactivarla si se quiere más evidencia visual.
- **Regla estricta del proyecto:** todo dato DIAN lleva prefijo `PRUEBA`; no generar CUFE, QR o firmas que parezcan reales.

### 3.3 Concurrencia e integridad
- `generate_client_code` y la validación de stock no son seguras ante peticiones simultáneas.
- No hay restricción en BD que impida `documents` con dos dueños (solo lo valida `create_document`).
- `users.role` es texto libre sin restricción.
- `payments.confirmed_at` y `receipt_uploaded_at` usan `datetime.utcnow()` (sin zona) mientras el resto usa fechas con zona.
- **Fechas:** se guarda UTC (`timestamptz`) y se muestra en `America/Bogota` con `formatDateTime`. Neon muestra UTC; es normal.

### 3.4 Seguridad
- `get_current_user` depende de que `decode_access_token` devuelva `None` al fallar y de que el `except Exception` general atrape el `AttributeError` posterior. Funciona, pero es frágil; conviene que lance una excepción explícita.
- Sin límite de intentos de login ni política de contraseñas. `PasswordChangeRequest`: revisar la longitud mínima.
- `.gitignore`: `Backend/.gitignore` cubre `.env`, `venv`, `uploads`; `Frontend/.gitignore` **no** lista `.env` (hoy no está versionado, pero conviene agregarlo). Hay un `.DS_Store` versionado en la raíz.
- CORS acepta solo `localhost:5173` y `192.168.x.x:5173`: hay que ampliarlo para un despliegue real.
- `Frontend/.env` define `VITE_API_BASE_URL` (con una IP de oficina) pero `services/api.js` lo ignora y arma la URL con `window.location.hostname:8000`. Para producción: usar la variable de entorno.
- La cámara dentro de la app (botón "Escanear QR") solo funciona con **HTTPS o localhost**. Con HTTP por IP hay que usar la cámara nativa del celular. El QR guarda la IP (`FRONTEND_URL`) del momento en que se generó la guía: si la IP cambia, hay que regenerarla.

### 3.5 Funcionalidad que falta o está a medias
- **Etapa 4, alerta de cartera a 30 días sin retirar.** Constante `PICKUP_FOLLOWUP_DAYS = 30`, contados desde el último retiro o desde el pago. Cartera debe verlo en `needs_action` y el detalle del pedido debe mostrar "Sin retirar hace N días". No se ha empezado.
- **`tax_rate` como fracción.** La columna `products.tax_rate` es `Numeric(5, 4)` (máximo 9,9999), así que guarda **`0.19`, no `19`**. El formulario de producto debe dividir entre 100 al enviar y multiplicar por 100 al cargar para editar. Enviar `19` produce el error `A field with precision 5, scale 4 must round to an absolute value less than 10^1`. Verificar que `ProductForm.jsx` lo haga, y que la proforma y la factura multipliquen por la fracción.
- **Responsive.** En móvil la tabla de productos y las cards (por ejemplo la del pago) se cortan a la derecha. Causas habituales: hijos de grid/flex sin `min-width: 0`, tabla sin contenedor con `overflow-x: auto`, anchos fijos o `white-space: nowrap` en `OrderDetail.css`. En escritorio, las cards de documentos dentro de cada retiro quedan estrechas en la columna lateral: reducir padding y poner la fecha de vencimiento en su propia línea.
- **Retiros.**
  - Creación masiva: un pedido de 500 m³ en volquetas de 8 T genera ~94 retiros, uno por uno hoy.
  - Edición de cantidades de un retiro: hoy se cancela y se crea de nuevo.
  - Definir quién sube los documentos cuando el transportador es sustituto.
- **Stepper del pedido.** Decidir entre pasos derivados de los retiros o una línea-resumen ("2 de 3 retiros despachados").
- **Verificaciones del cambio a `partially_dispatched`:** que aparezca en filtros y badges de `Orders.jsx`; buscar restos con `grep -rn "transport_validated\|dispatch_guide_generated" Frontend/src Backend/app`; revisar el CHECK de `orders.status`.
- **Permisos pendientes:** acceso de solo lectura de logística a proforma y factura (bloque `ROLES_PERMISSIONS`) y guards `RequirePermission` en las rutas del frontend.
- Solicitud de cambio iniciada por el cliente (no implementada).
- Pulido visual de la pantalla de verificación de portería.
- Interfaz para: usuarios, generar magic link, lista negra, vehículos/transportadores, tareas pendientes. (Menú con entradas comentadas en `constants/menu.js`.)
- `audit_log` (historial antes/después). `deleted_by_user_id` nadie lo usa.
- `order:anular` solo lo tiene admin: los clientes no pueden anular sus pedidos. ¿Es lo deseado?
- Descuento de inventario solo al **salir** por portería: si un retiro nunca sale, la reserva sigue contando hasta que el pedido se anule o despache. Revisar con negocio la política de pedidos abandonados.
- Pedidos `payment_confirmed` que no lleguen a `facturado` no deberían existir; si apareciera alguno en la base, hay una inconsistencia que revisar con SQL.
- Pruebas automatizadas: ninguna. Candidatas con mejor retorno: `get_reserved_stock`/`get_sellable_stock`, `confirm_payment` (incluido rollback), `validate_assignment`, `compute_missing_documents`, `register_guide_exit`.
- `TransportCard.jsx` tiene ~1.400 líneas: candidato a dividirse (formulario de retiro, revisión de Logística, guía).
- `Frontend/src/constants/colombia.js` (4.487 líneas) se genera con `Backend/scripts/build_colombia.py`; no editar a mano.

### 3.6 Decisiones pendientes con el negocio
| Tema | Estado |
|------|--------|
| Capacidad insuficiente del vehículo: ¿**bloquea** el retiro o solo **advierte**? | Hoy solo advierte (`capacityStatus`: short / tight / ok / oversized). |
| Umbrales `OVERSIZE_FACTOR = 3` y `TIGHT_RATIO = 0.9` | Provisionales; validar con el jefe. |
| Solicitud de cambio iniciada por el cliente | Sin definir. |
| Peso y precio de materiales de arrastre | Cargados con valores de prueba (arena ≈ 1.500 kg/m³, $30.000/m³). Confirmar con la hacienda. |

## 4. Decisiones de diseño tomadas (y por qué)

| Decisión | Motivo |
|----------|--------|
| Login por **número de documento**, no email | Los usuarios son personas con cédula; el email es opcional. |
| Precios y totales congelados en el pedido | Cambiar un precio no debe alterar pedidos históricos ni facturas. |
| Stock reservado **calculado**, no guardado | Evita movimientos de reserva y de reversión; anular un pedido libera automáticamente. Fórmula: reservado = pedido (no anulado ni despachado) − despachado (retiros con guía `used`); disponible = físico − reservado. |
| Salida de inventario en portería | El inventario sale cuando la mercancía realmente sale de la planta, retiro por retiro. |
| Inventario inmutable, correcciones por ajuste | Trazabilidad y auditoría. |
| Productos "paquete" apuntan a un producto base | Un solo inventario físico, varias presentaciones de venta. |
| Transporte de **terceros validado**, no asignado | El cliente trae su camión; la planta valida documentos y antecedentes. |
| Un pedido tiene **varios retiros** (`Assignment` + `AssignmentItem`), uno con su propia guía | Los despachos son parciales; cada viaje tiene su vehículo, sus documentos y su guía. |
| Un retiro puede anularse sin tocar el pedido | Libera cantidades para reprogramar (cliente no llegó). |
| Capacidad del vehículo solo desde el **tipo** (`capacity_kg`) | Evita datos duplicados e inconsistentes por placa. |
| El QR **no es de un solo uso**: valida ingreso y salida; tras la salida queda inservible | Control completo de la puerta; el descuento de inventario ocurre en la salida. |
| Portería con rol propio (`dispatch_guide:verificar`) y escaneo con cámara dentro de la app | Que quien está en la puerta solo pueda registrar ingreso y salida. |
| Hallazgo en `listas_vinculantes` bloquea; en SIMIT/antecedentes solo se registra | Constante `BLOCKING_TRANSPORT_CHECKS`. |
| El QR solo contiene un token | Evita falsificar datos: todo se consulta al servidor. |
| Quien valida el transporte no puede subir documentos | Para que la revisión no pueda reemplazar lo que evalúa. |
| El veto no revela el motivo al cliente | Información interna. |
| Los hallazgos de listas vinculantes no se muestran al cliente | `hide_sensitive_checks`. |
| Factura con proveedor **simulado** | No hay integración DIAN todavía; todo marcado `PRUEBA`. |
| Manifiesto de carga electrónico (RNDC) fuera de alcance | Requeriría habilitación como transportadora e integración con el Ministerio de Transporte. |
| `PEP/PPT/…` y tipos de documento colombianos como listas fijas | Reglas del negocio colombiano (`constants/`). |
| Cuentas bancarias solo de la empresa propia | `_resolve_company_id` lo exige. |

## 5. Cómo trabajar con seguridad (checklist antes de cambiar algo)

1. Lee el flujo en [02](02-flujo-del-pedido.md) y busca la función en [Backend/docs/servicios.md](../Backend/docs/servicios.md).
2. Si cambias un **modelo**: crea una migración nueva (nunca edites una aplicada), **guárdala antes de ejecutar** `alembic upgrade head` y luego `alembic check`.
   - Si se ejecutó `upgrade` con el archivo vacío, Alembic queda marcado como actualizado sin cambios: corregir con `alembic stamp <down_revision>` y volver a `alembic upgrade head`.
   - Todo modelo nuevo debe importarse en `alembic/env.py` **y** estar importado en tiempo de ejecución (por ejemplo `AssignmentItem` desde `models/assignment.py`); si no, SQLAlchemy falla con un error de mapper.
3. Si cambias una **regla**: ponla en el servicio (o en `constants/` si no depende de servicios) y atrapa `ValueError` en el router.
4. Si agregas un **endpoint**: permiso en `auth_dependencies.py`, `try/except ValueError → rollback → 400`, 404 para ajenos. Un solo `commit` al final del router (no dentro de helpers: un commit intermedio dejó un retiro a medias).
5. Si agregas una **pantalla**: ruta en `App.jsx`, `hasPermission` para botones, `showToast` para resultados.
6. FastAPI **descarta los campos no declarados** en `response_model`: si agregas un campo a la respuesta, decláralo en el schema.
7. Prueba con la guía [05](05-guia-de-pruebas.md) y actualiza estos documentos en el mismo commit.

### Limpiar la base de datos conservando los usuarios
```sql
BEGIN;
SELECT count(*) AS usuarios_antes FROM users;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables
           WHERE schemaname = 'public' AND tablename NOT IN ('users', 'alembic_version')
  LOOP
    EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;
SELECT count(*) AS usuarios_despues FROM users;
-- Si coinciden: COMMIT;   Si no: ROLLBACK;
```
Cuidado: `CASCADE` puede vaciar `users` si tiene una FK hacia otra tabla (por ejemplo `company_id`); por eso se verifica antes del `COMMIT`. También borra los catálogos (productos, tipos de vehículo, empresas): agrégalos al `NOT IN` si quieres conservarlos. Los archivos de `uploads/` no están en la base de datos y quedan huérfanos.