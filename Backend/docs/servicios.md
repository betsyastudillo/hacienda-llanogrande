# Referencia de servicios (cada función)

Convenciones: todos reciben `db: Session` primero; lanzan `ValueError("mensaje en español")` para rechazar una
operación (el router lo convierte en HTTP 400); las funciones `get_*` devuelven `None` cuando no existe y el router
responde 404. Las funciones que empiezan con `_` son privadas del módulo.

Leyenda de **commit**: ✔ = hace `db.commit()` (queda guardado) · ✘ = no hace commit (lo hace quien llama).

---

## `order_service.py` — pedidos
Constantes: `CLIENT_ROLES`, `STAFF_VIEW_ALL_ROLES = (admin, soporte)`, `CANCELLABLE_STATUSES = ("created",)`,
`WITHDRAWAL_ORDER_STATUSES = ("facturado", "partially_dispatched")` (estados en que se pueden registrar/mover retiros).

| Función | Qué hace | Reglas / errores |
|---|---|---|
| `generate_order_number(db)` | Devuelve `PED-AAAA-NNNN`. Año en hora Colombia. Usa `INSERT … ON CONFLICT DO UPDATE … RETURNING` sobre `order_counters` (atómico) | ✘ |
| `get_item_quantities(db, order_id)` | Devuelve `(asignado, despachado)`: dict `order_item_id → cantidad`. *Asignado* = suma de retiros no anulados; *despachado* = los que tienen guía `used` | solo lectura |
| `attach_item_balances(db, order)` | Pone atributos temporales `assigned_quantity`, `dispatched_quantity`, `pending_quantity` en cada ítem (para el detalle) | |
| `get_orders(db, user)` | Lista pedidos más recientes primero. `cliente_admin` → su empresa; `cliente_operativo` → los que creó; los demás → todos. Luego llama `attach_needs_action` | |
| `get_order_by_id(db, id)` | Pedido con su empresa, o `None` | |
| `can_access_order(order, user)` | ¿Puede ver este pedido? (ver [docs/03](../../docs/03-arquitectura.md#32-acceso-a-recursos-ajenos--404)) | |
| `_resolve_company_id(order, user)` | Clientes: su propia empresa (ignora cualquier `company_id` del cuerpo). Admin: debe indicar `company_id`. Otro rol: error | `ValueError` |
| `create_order(db, order, user)` | Crea pedido + ítems. Valida: empresa existe, **activa** y **aprobada**; producto existe y activo; cantidad ≤ stock vendible. Calcula `subtotal`, `tax = subtotal × tax_rate`, `total`; congela `unit_price` | ✔. Errores: empresa/producto/stock |
| `edit_order(db, id, data, user)` | Reemplaza los ítems. Solo en `created` y sin proforma | ✔. `PermissionError` si no tiene acceso (el router → 403, ver [06](../../docs/06-pendientes-y-decisiones.md)) |
| `cancel_order(db, id, reason, user)` | Pasa a `cancelled`. Solo desde `created`; motivo obligatorio; si el cliente ya subió comprobante pendiente, obliga a resolver el pago primero; un pago `pending` pasa a `cancelled` | ✔ |
| `attach_needs_action(db, orders, user)` | Calcula `order.needs_action` (bool) por rol: **cartera** → pago pendiente con comprobante; **logística** → retiro por validar (con documentos completos), aprobado sin guía, o con revisión pendiente; **cliente** → falta proforma/comprobante, o cantidades por programar, o retiro rechazado/incompleto. Hace pocas consultas agrupadas (evita N+1) | |

## `payment_service.py` — proforma, comprobante, confirmación
Constantes: `RECEIPTS_DIR`, `ALLOWED_RECEIPT_EXTENSIONS`, `MAX_RECEIPT_SIZE_BYTES = 5 MB`.

| Función | Qué hace |
|---|---|
| `get_payments`, `get_payment_by_order`, `get_payment_by_id` | Consultas simples |
| `save_receipt_file(file, payment_id)` | Valida extensión, no vacío, ≤ 5 MB; guarda en `uploads/receipts/<payment_id>/<uuid>.<ext>`; devuelve la ruta con "/" inicial |
| `upload_receipt(db, payment_id, file)` | Sube o reemplaza el comprobante (solo si el pago está `pending` o `failed`). Pone el pago en `pending` y limpia el motivo de rechazo. Borra el archivo viejo **después** del commit ✔ |
| `create_payment(db, order_id, bank_account_id)` | Crea la proforma `PRO-…`. Requiere pedido `created`, que no exista otro pago y cuenta bancaria activa. Genera el PDF; si falla, `rollback` y borra la carpeta ✔ |
| `confirm_payment(db, payment_id, status, reason)` | `status="confirmed"`: exige comprobante, marca pago confirmado, pedido → `payment_confirmed`, crea la factura `pending`, llama `get_provider().emit(...)`, genera el PDF de la factura, factura → `issued` y pedido → **`facturado`**, todo en una transacción. Si falla algo: `rollback`, borra el PDF y relanza. `status="failed"`: exige motivo, pago → `failed` ✔ |

## `invoice_provider.py` / `invoice_pdf.py` / `invoice_service.py` — facturación
- `ProviderResult` (dataclass): `invoice_number, cufe, issued_at, signed_at, signature, qr_data, provider`.
- `SimulatedProvider.emit(order, invoice)`: devuelve datos falsos pero deterministas con prefijo **`PRUEBA-`** (SHA-384 como "CUFE", SHA-512 en base64 como "firma"); `qr_data` = `"SIMULACION SIN VALIDEZ FISCAL | …"`.
- `get_provider()`: **único punto a cambiar** para integrar un proveedor real (clase nueva con el mismo `emit`).
- `generate_invoice_pdf(db, invoice, order, qr_data) -> str`: arma el PDF con reportlab (datos del vendedor = empresa `own`, del comprador, ítems, totales en letras con `num2words`, QR y leyenda de simulación; la marca de agua `_watermark` está definida pero desactivada) en `uploads/invoices/<invoice_id>/` y devuelve la ruta.
- `invoice_service.get_invoice_by_order / get_invoice_by_id`: consultas. (El archivo también declara `INVOICES_DIR` y `MAX_SIZE` sin uso.)

## `proforma_pdf.py` y `pdf_helpers.py`
- `generate_proforma_pdf(db, payment, order, bank_account) -> str`: PDF de la proforma en `uploads/proformas/<payment_id>/` con logo `assets/logo.png`, datos del cliente, ítems, totales y la cuenta bancaria donde consignar.
- `pdf_helpers`: `to_local(dt)` (a hora Colombia; una fecha sin zona se toma como UTC), `format_date(dt, with_time)` (`05 / NOV / 2026`), `full_address(company)`.

## `inventory_service.py` — inventario
Constantes: `ADJUSTMENT_CATEGORIES = (damage, count_difference, other)`, `NON_RESERVING_ORDER_STATUSES = (cancelled, dispatched)`.

| Función | Qué hace |
|---|---|
| `get_current_stock(db, product_id)` | Físico = entradas − salidas + ajustes (del producto base) |
| `get_reserved_stock(db, base_id)` | Unidades del producto base ya vendidas y aún no sacadas: Σ(cantidad pedida × `units_per_pack`) en pedidos no anulados/despachados − Σ(lo ya despachado con guía `used`) |
| `get_available_stock(db, base_id)` | Físico − reservado |
| `get_sellable_stock(db, product)` | Lo que se puede vender de **ese** producto: base → disponible; paquete → `floor(disponible / units_per_pack)`; nunca negativo |
| `resolve_stock_target(product)` | Devuelve el producto base (si es paquete) o él mismo |
| `get_deduction_quantity(product, qty)` | Convierte paquetes a unidades base; error si el resultado no es entero |
| `get_movements_by_product(db, id)` | Historial, más reciente primero |
| `create_manual_movement(db, product_id, type, qty, reason, category, user)` | Entrada o ajuste manual ✔. Rechaza paquetes; entrada debe ser > 0; ajuste ≠ 0 y requiere categoría; categoría `damage` fuerza cantidad negativa |
| `_period_bounds`, `_sum_movements` | Auxiliares para el kardex (cortes de día en hora Colombia) |
| `_get_kardex(db, product_id, start, end)` | Saldo inicial, entradas, salidas, ajustes (daños vs otros), saldo final, reservado y disponible |
| `register_order_deduction(db, product, order_id, qty, user)` | Inserta un movimiento `salida` (descontando del base). **No hace commit**: lo llama `register_guide_exit` dentro de su transacción |

## `assignment_service.py` — retiros y validación de transporte (el módulo más grande)
Constantes: `PHONE_RE` (7–15 dígitos), `PLATE_RE` (5–6 alfanuméricos), `CORRECTABLE_ORDER_STATUSES`.

**Lectura**
- `attach_transport_details(db, assignments)`: a cada retiro le pega (atributos temporales) `vehicle`, `carrier`, `dispatch_guide`, `documents` (con `is_expired`), `missing_documents`, `blocked` (`vehicle|owner|carrier` vetados), `checks` y `required_checks`. Lo usan casi todas las demás funciones.
- `get_assignments`, `get_assignments_by_order`: listados.
- `get_accessible_assignment(db, id, user)`: retiro + pedido, o `ValueError("Order not found")` (el router → 404) si el usuario no puede ver el pedido.
- `hide_sensitive_checks(assignment, user)`: a clientes les quita las consultas bloqueantes (`listas_vinculantes`).
- `lookup_owner / lookup_vehicle / lookup_carrier`: ayudas para autocompletar el formulario. Devuelven `blocked` si está vetado y, a un cliente, solo datos que **su empresa** ya usó (no revelan los de otros).

**Registro**
- `_validate_withdrawal_items`: cantidades > 0, sin repetir producto, ≤ pendiente por programar de cada ítem.
- `_validate_submission`: placa, tipo de vehículo activo, dueño, tipo de documento, teléfono, dirección del transportador.
- `_ensure_not_blacklisted`: rechaza placa, transportador o dueño vetados (sin decir el motivo).
- `_find_or_create_vehicle(db, data, user)` / `_find_or_create_carrier(...)`: reutilizan por placa / por documento y actualizan los datos que cambien. Si cambia el **dueño**, el `documento_propietario` anterior queda `rejected` (hay que subir otro). Un transportador inactivo no se puede usar. ✘
- `create_assignment(db, data, user)`: valida pedido accesible y en `facturado/partially_dispatched`, cantidades, datos, veto; crea el retiro con `sequence = max+1` y sus `assignment_items` ✔.
- `resubmit_assignment(...)`: corrige y vuelve a `pending` sobre el mismo retiro (limpia motivo y validación) ✔.

**Documentos**
- `_validate_transport_file`: extensión y ≤ 5 MB.
- `upload_transport_document(db, assignment_id, subject, document_type, file, user, expires_at)`: solo en `pending/rejected`; **quien valida (`assignment:validar`) no puede subir**; valida tipo permitido y fecha de vencimiento (SOAT/licencia: obligatoria, no vencida, ≤ 10 años); reemplaza el documento existente o crea uno ✔.
- `get_transport_document`: el documento solo si pertenece al vehículo/transportador de ese retiro.
- `review_transport_document(...)`: aprueba/rechaza un documento `pending` (no se aprueba uno vencido; rechazo exige motivo) ✔.

**Decisión de Logística**
- `validate_assignment(db, id, decision, rejection_reason, background_check_verified, blacklist_carrier, user, checks, blacklist_vehicle, blacklist_owner)`: 
  1. Retiro `pending`, no anulado; decisión `approved|rejected`; rechazo exige motivo.
  2. Valida las `checks` enviadas (claves válidas; hallazgo exige nota) y que sus `subject_ref` coincidan con el transporte actual (si cambió mientras verificaban → error).
  3. Si **aprueba**: pedido en estado de retiros, nadie vetado, sin documentos faltantes, todos los obligatorios **aprobados**, todas las consultas registradas, ninguna bloqueante con hallazgo.
  4. Guarda decisión y reemplaza los `transport_checks`.
  5. Si **rechaza**: puede vetar transportador (y lo desactiva), vehículo y/o dueño ✔.
- `_blacklist(...)`: inserta en `document_blacklist` si no estaba.
- `correct_assignment(db, id, vehicle, carrier, reason, user)`: Logística cambia quién recoge. Si ya estaba aprobado exige motivo y, si cambió el vehículo/transportador, deja `review_pending=True` ✔. No permite si está anulado, despachado o el pedido ya no está en retiros (`_ensure_assignment_open`).
- `complete_post_review(db, id, checks, user, blacklist_*, reason)`: registra las consultas faltantes tras una corrección y limpia `review_pending`; puede vetar ✔.
- `cancel_assignment(db, id, reason, user)`: anula (`cancelled_at`) liberando cantidades. No si la guía está `in_plant` o `used` ✔.
- `_used_by_company(...)`: ¿esta empresa ya usó ese vehículo/transportador? (para los `lookup_*`).

## `dispatch_guide_service.py` — guías y portería
| Función | Qué hace |
|---|---|
| `get_dispatch_guides`, `get_dispatch_guides_by_order` | Listados (por pedido, en orden de retiro) |
| `build_cargo_detail(assignment)` | Texto: `"10 kg Manzana, 5 canasta Uva"` |
| `build_balance_detail(db, order, assignment)` | Texto del saldo restante tras este retiro. ⚠️ **Tiene un error de sangría conocido** ([06](../../docs/06-pendientes-y-decisiones.md) #1) |
| `generate_qr_image(assignment_id, token)` | Crea `uploads/dispatch_guides/<assignment>/qr.png`. El QR contiene solo `FRONTEND_URL/dispatch-guides/verify/<token>` |
| `create_dispatch_guide(db, assignment_id, user)` | Requiere retiro no anulado, aprobado, con ítems y sin guía previa; pedido en estado de retiros; nadie vetado; existir la empresa `own` (origen = su dirección; destino = la del cliente). Token aleatorio de 32 bytes ✔ |
| `_load_guide_context(db, token)` | Carga guía, pedido, retiro, vehículo, transportador y detalle; error si token inválido o retiro anulado |
| `_build_verification(...)` | Arma la respuesta de portería; `can_enter` = pendiente y no vetado; `can_exit` = en planta |
| `get_guide_for_verification(db, token)` | Solo consulta |
| `register_guide_entry(db, token, user)` | `pending → in_plant` (bloquea si hay vetado) ✔ |
| `register_guide_exit(db, token, user)` | `in_plant → used`; inserta una `salida` por ítem (`register_order_deduction`); recalcula despachado y pone el pedido en `dispatched` (todo completo) o `partially_dispatched` ✔. Un vehículo vetado que ya está dentro **sí** puede salir |

## `company_service.py` — empresas
| Función | Qué hace |
|---|---|
| `_validate_person_type`, `_validate_business_sector`, `_resolve_document_type` | Validaciones. Jurídica → documento siempre `NIT` |
| `get_companies(db, user, company_type, include_inactive, verification_status)` | Lista y agrega `needs_action` |
| `get_company_by_id`, `get_company_by_client_code` | Búsquedas |
| `generate_client_code(db, company_type)` | `HAC-NNNN` / `CLI-NNNN` (máximo + 1) |
| `create_a_company(db, company, user)` | Crea en `draft`. Mensajes distintos si el documento ya existe: rechazada definitiva, desactivada, rechazada por documentos, u otro caso ✔ |
| `submit_company` | draft → pending. Exige rep. legal (jurídica), documentos requeridos, todas las consultas por sujeto y notas en hallazgos ✔ |
| `edit_company` | Edita solo campos de la lista blanca. Cambios en empresa aprobada hechos por quien **no** puede aprobar la devuelven a `pending` (o `draft` si cambió el representante) ✔ |
| `_check_can_toggle`, `reactivate_company`, `deactivate_company` | Desactivar/reactivar. Sin `company:desactivar` solo se permite en borrador. No se desactiva la empresa `own` ✔ |
| `verify_company(db, id, decision, reason, type, user)` | Admin aprueba/rechaza una `pending` (no aprueba con documentos rechazados; rechazo exige motivo y tipo `documents|compliance`) ✔ |
| `resubmit_company` | rejected(documents) → pending si no quedan documentos rechazados ✔ |
| `attach_needs_action` | `needs_action`: admin → pendientes; operaciones → borradores, rechazadas por documentos o con documentos rechazados |

## `compliance_check_service.py`
- `get_checks_by_company(db, company_id)`.
- `upsert_check(db, company_id, check_key, has_findings, note, user, subject)`: crea o actualiza una consulta; solo con la empresa en `draft`; la clave debe aplicar al sujeto y al sector; hallazgo exige nota; sin hallazgo borra la nota ✔.

## `document_service.py` — documentos (empresa / vehículo / transportador)
`get_documents_by_company|vehicle|carrier`; `save_document_file(file, owner_id)` (guarda en `uploads/documents/<owner>/<uuid><ext>`, **sin validar** tipo ni tamaño); `create_document(...)` (exige exactamente un dueño; estado `pending`) ✔; `update_document_status(db, id, status, user)` ✔; `replace_document_file(...)` (reemplaza, vuelve a `pending`, borra el archivo viejo tras el commit) ✔.

## `document_blacklist_service.py`
`get_blacklist`; `is_document_blacklisted(db, type, number)` (activo); `blacklist_document(...)` (veta y **desactiva** transportadores con ese documento) ✔; `remove_from_blacklist(db, id)` (`is_active=False`) ✔.

## `bank_account_service.py`
`_validate_fields` (tipo ahorros/corriente; tipo de documento NIT/CC/CE/PP) · `_resolve_company_id` (por defecto la empresa `own`; solo ella) · `_check_duplicate` (banco+número activos) · `get_bank_accounts(db, user, only_active)` (clientes solo activas) · `get_bank_account_by_id` · `create_bank_account` ✔ · `edit_bank_account` ✔ · `deactivate_bank_account` ✔ · `reactivate_bank_account` (revalida duplicados) ✔.

## `product_service.py`
`get_products` / `get_product_by_id` (solo activos) · `_validate_unit` (`constants/units.VALID_UNITS`) · `_validate_pack_fields` (`parent_product_id` y `units_per_pack` juntos; el padre existe y no es paquete; `units_per_pack > 0`) · `_resolve_approx_weight` (si es paquete sin peso, = peso del padre × unidades) · `create_product` ✔ · `edit_product` ✔ · `deactivate_product` ✔.

## `user_service.py`, `auth_service.py`, `magic_link_service.py`
- `auth_service`: `hash_password`, `verify_password` (bcrypt), `create_access_token(data)` (agrega `exp`), `decode_access_token(token)` (devuelve `None` si es inválido).
- `user_service`: `get_users`, `get_user_by_document_id`, `get_user_by_id`, `authenticate_user`, `create_user`, `update_user`, `update_own_profile`, `change_password`, `deactivate_user`.
- `magic_link_service`: `create_magic_link(db, user_id, user)` (solo roles cliente, usuario activo; 48 h) ✔ · `verify_magic_link(db, token)` (válido, no usado, no vencido, usuario y empresa activos; lo marca `used`; devuelve un access token) ✔.

## Otros
- `carrier_service` (`get_carriers` activos, `create_carrier`, `edit_carrier`, `deactivate_carrier`) y `vehicle_service` (`get_vehicles`, `create_vehicle`, `edit_vehicle`): CRUD directo, poco usado ([06](../../docs/06-pendientes-y-decisiones.md) #8).
- `vehicle_type_service`: `list_vehicle_types`, `active_vehicle_type_codes`, `create_vehicle_type` (el `code` se deriva del nombre), `update_vehicle_type`.
- `pending_task_service.get_pending_tasks`: lista empresas `pending` como tareas del admin.
- `transport_service.py`: archivo vacío.
