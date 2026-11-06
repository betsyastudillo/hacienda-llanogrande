# 01 · Visión y estado actual

## 1. Qué se quería lograr

Un sistema que reemplace el manejo manual (llamadas, WhatsApp, hojas de cálculo) del proceso comercial de
**Hacienda Llanogrande**:

1. **Clientes verificados.** Solo empresas/personas revisadas (documentos + consultas en listas vinculantes) y
   aprobadas por un administrador pueden comprar.
2. **Pedidos con precio congelado.** El cliente arma su pedido con el catálogo; el sistema valida que haya
   inventario vendible y guarda precios e impuestos *al momento de la venta*.
3. **Cobro por consignación bancaria.** Se genera una proforma PDF; el cliente consigna y sube el comprobante;
   Cartera lo confirma o lo rechaza con motivo.
4. **Facturación automática.** Al confirmar el pago se emite la factura en la misma transacción (hoy con un
   proveedor simulado; la intención es enchufar un proveedor tecnológico real sin cambiar el resto).
5. **Retiros con transporte de terceros.** El cliente envía su vehículo; el sistema no lo "asigna", lo **valida**:
   documentos vigentes (SOAT, licencia…), consultas (SIMIT, listas, antecedentes) y lista negra. Un pedido puede
   retirarse en **varios retiros** (despacho parcial).
6. **Control en portería.** Cada retiro aprobado genera una guía con QR. El QR solo contiene un token; en portería se
   verifica contra el sistema, se registra el ingreso y la salida, y **solo en la salida se descuenta el inventario**.
7. **Inventario confiable e inmutable.** Entradas, ajustes y salidas son movimientos que nunca se borran; los errores
   se corrigen con un movimiento nuevo. Hay kardex por periodo.
8. **Trazabilidad.** Casi todas las tablas guardan quién y cuándo las creó/modificó.

El proyecto nació como **prueba técnica** (negocio de áridos) y se decidió dejarlo como **base real de producción**
para productos cosechados. Por eso hay decisiones que miran hacia producción (permisos finos, archivos protegidos,
migraciones cuidadas) junto a piezas deliberadamente simuladas (factura electrónica).

## 2. Estado por módulo (según el código a 2026-11-06)

Leyenda: ✅ funcional de punta a punta · 🟡 funcional con huecos · 🔴 no existe / solo esqueleto.

| Módulo | Backend | Frontend | Notas |
|--------|:------:|:--------:|-------|
| Autenticación (login, refresh, `/users/me`) | ✅ | ✅ | Sesión de 30 min por defecto, aviso 2 min antes y renovación. Ver bug en AuthContext en [06](06-pendientes-y-decisiones.md). |
| Magic link (login de clientes sin contraseña) | ✅ | 🟡 | Backend completo. **No hay pantalla** para generarlo (solo Swagger) y la ruta `/link-login` está dentro de `ProtectedRoute`, así que un visitante sin sesión es redirigido a `/login` antes de poder usarla (ver [06](06-pendientes-y-decisiones.md)). |
| Usuarios (CRUD) | ✅ | 🔴 | Solo por Swagger. En el menú está comentado "Usuarios". |
| Empresas (alta, borrador→revisión→aprobada/rechazada, desactivar) | ✅ | ✅ | Flujo de 4 estados con documentos y listas vinculantes. |
| Documentos de empresa | ✅ | ✅ | Subida, revisión, reemplazo. |
| Cuentas bancarias | ✅ | ✅ | CRUD + desactivar/reactivar. |
| Productos (con paquetes) | ✅ | ✅ | Producto base + presentaciones. |
| Inventario (movimientos, stock, kardex) | ✅ | ✅ | Reserva calculada; salida real al despachar. |
| Pedidos (crear, editar, anular, listar con "requiere acción") | ✅ | ✅ | |
| Pagos (proforma, comprobante, confirmar/rechazar) | ✅ | ✅ | PDF de proforma generado con reportlab. |
| Facturación | 🟡 | ✅ | Proveedor **simulado**; no se genera XML (`xml_url` existe pero nunca se llena). |
| Retiros / validación de transporte | ✅ | ✅ | Es el módulo más grande (≈1000 líneas de servicio, ≈1400 de pantalla). |
| Guías de despacho + QR + portería | 🟡 | ✅ | Funciona; ver bug en `build_balance_detail` ([06](06-pendientes-y-decisiones.md)). |
| Lista negra | ✅ | 🔴 | Solo Swagger (y se alimenta al rechazar un transporte). |
| Tipos de vehículo | ✅ | ✅ | |
| Vehículos / Transportadores (CRUD directo) | 🟡 | 🔴 | Se crean automáticamente al registrar un retiro; los endpoints CRUD existen pero la interfaz no los usa. `vehicle_service` está desactualizado respecto al modelo. |
| Tareas pendientes de admin (`/admin/pending-tasks`) | 🟡 | 🔴 | Solo lista empresas por aprobar. |
| Auditoría detallada (`audit_log`) | 🔴 | 🔴 | Solo existen las columnas `created_by/updated_by`. |
| Pruebas automatizadas | 🔴 | 🔴 | No hay. Todas las pruebas son manuales ([05](05-guia-de-pruebas.md)). |

## 3. Qué cambió durante el desarrollo (útil para entender el código "raro")

El historial de Alembic y de git cuenta la evolución:

1. **Áridos → Hacienda.** `materials` pasó a `products` (migración `6de909b25201`), se agregaron paquetes, unidades y peso.
2. **Transporte propio → transporte de terceros.** Antes el sistema "asignaba" un vehículo propio por capacidad; ahora
   *valida* el de terceros por documentos. Se eliminó `capacity_m3` y `is_active` del vehículo; la capacidad (en kg)
   vive en `vehicle_types`.
3. **De un retiro por pedido a muchos.** Migración `caffaa585f24_partial_dispatches`: nacen `assignment_items`,
   `assignments.sequence`, anulación de retiros, y el estado de pedido `partially_dispatched`.
4. **Flujo de estados más corto.** Antes: `created → transport_assigned → payment_confirmed → dispatch_guide_generated →
   dispatched`. Ahora el transporte y la guía **ya no cambian el estado del pedido**; viven en el retiro y su guía
   (ver [02](02-flujo-del-pedido.md)). Por eso el README antiguo y parte de `CLAUDE.md` estaban desfasados.
5. **Pago por webhook → pago por consignación manual.** El `PAYMENT_WEBHOOK_SECRET` es un residuo.
6. **Portería.** Nuevo rol `porteria` y verificación de guía por QR (commit `3781d6a`).
7. **Auditoría.** Migración `3c10f5c69c11` añadió las 5 columnas de `AuditMixin` a todas las tablas.

## 4. Punto exacto en el que estamos

> ✍️ **PARA COMPLETAR POR BETSY (quien entrega el proyecto).** El código muestra *qué existe*, pero no *qué estabas
> haciendo ni qué ibas a hacer después*. Completa esta sección con tus palabras. Sugerencia de preguntas:

### 4.1 Último trabajo realizado
Del historial de git, lo más reciente es: *Elimina los placeholders de los campos de entrada en el formulario de productos*
(commit `313a3f2`), *Actualización del servicio de productos y de los componentes del frontend para mejorar la gestión de
pedidos* (`a81ddd5`), los despachos parciales (`ed634b9`) y la verificación por QR en portería (`3781d6a`).
Al terminar esta documentación, el único cambio sin commitear del código son los **docstrings** agregados (ver
[README raíz](../README.md#documentación-y-docstrings)) y los archivos `.md` nuevos.

### 4.2 Lo que estabas haciendo cuando paraste
- _[completar]_

### 4.3 Lo siguiente que querías hacer (en orden de prioridad)
1. _[completar]_
2. _[completar]_
3. _[completar]_

### 4.4 Decisiones de negocio abiertas (esperando respuesta del dueño/cliente)
Del código y de la documentación anterior se infiere que siguen abiertas:
- **Factura real**: qué proveedor tecnológico, formato de numeración (`invoice_number` hoy copia el número de pedido;
  el comentario del modelo menciona un formato tipo `FHDA578`), y el recálculo de impuestos.
- **IVA por producto**: `tax_rate` es editable por producto (19 % por defecto). ¿Hay productos excluidos o exentos?
- **Régimen del vendedor** en la factura: hoy fijo "No responsable de IVA" ([invoice_pdf.py](../Backend/app/services/invoice_pdf.py)),
  pero los pedidos calculan IVA. Hay una incongruencia que debe resolver el negocio.
- ¿Se mantiene el sector `construccion` (consulta `dian_proveedores_ficticios`) o solo `agro`?
- _[completar otras]_

### 4.5 Cosas que descartaste o decidiste NO hacer
- _[completar]_ (Ej.: manifiesto de carga electrónico RNDC — la documentación anterior ya lo daba como fuera de alcance.)

### 4.6 Contexto del entorno
- Dónde está desplegado (si lo está) / solo corre en local: _[completar]_
- Quién administra la base de datos Neon y dónde están las credenciales: _[completar — **no escribir las credenciales aquí**]_
- Usuarios y datos de prueba existentes en la base: _[completar]_
- Ramas de git activas: hoy solo se ve `main`.

## 5. Ideas de siguientes pasos (propuesta, a validar)

Ordenadas por riesgo/valor. Ver detalles y archivos en [06](06-pendientes-y-decisiones.md).

1. **Corregir los bugs conocidos** (balance de la guía, `err` indefinido en `AuthContext`, bloqueo de concurrencia en retiros).
2. **Crear el script de primer admin** (`seed_admin.py` documentado pero inexistente).
3. **Pruebas automáticas** de los servicios críticos (`confirm_payment`, `create_order`, `validate_assignment`,
   `register_guide_exit`, stock reservado).
4. **Pantallas faltantes**: usuarios, magic link, lista negra.
5. **Proveedor de factura real** implementando `emit()` con la misma interfaz que `SimulatedProvider`.
6. **`audit_log`** si el negocio lo exige.
7. **Limpieza del dominio anterior**: renombrar `quantity_m3`, retirar `constants/roles.py` y `require_role`.
