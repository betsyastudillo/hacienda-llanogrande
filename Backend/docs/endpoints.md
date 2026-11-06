# Referencia de endpoints

Todos exigen sesión (`Authorization: Bearer <token>`) salvo `POST /auth/login`, `GET /magic-links/verify/{token}` y `GET /`.
La columna **Permiso** es el tipo de [auth_dependencies.py](../app/auth_dependencies.py) y entre paréntesis la cadena de
permiso. `admin` pasa siempre. Los prefijos son plurales (`/orders`, no `/order`).
Una **fila gris de nota** indica reglas extra que el endpoint aplica *dentro* de la función.

Estados de error comunes: 401 sin sesión · 403 sin permiso · 404 no existe o no es tuyo · 400 regla de negocio (`detail` en español).

## Auth — `/auth`
| Método y ruta | Permiso | Qué hace | Servicio |
|---|---|---|---|
| `POST /auth/register` | `UserManager` (`user:gestionar`) | Crea un usuario | `user_service.create_user` |
| `POST /auth/login` | público | Valida documento + contraseña, devuelve JWT. 403 si la empresa está desactivada | `authenticate_user`, `create_access_token` |
| `POST /auth/refresh` | `CurrentUser` | Entrega un token nuevo a quien aún tiene uno vigente | `create_access_token` |

## Usuarios — `/users`
| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `GET /users/me` | `CurrentUser` | Perfil + lista de `permissions` del rol (lo usa el frontend) |
| `PUT /users/me` | `CurrentUser` | Edita nombre y email propios (no rol/empresa) |
| `PATCH /users/me/password` | `CurrentUser` | Cambia contraseña (pide la actual) |
| `GET /users/` · `GET /users/{id}` | `UserManager` | Lista / detalle |
| `PUT /users/{id}` | `UserManager` | Edita nombre, email, rol, empresa, activo |
| `DELETE /users/{id}` | `UserManager` | **Desactiva** (no borra) |

## Magic links — `/magic-links`
| `POST /magic-links/` | `UserManager` | Crea un enlace de 48 h para un usuario cliente activo |
|---|---|---|
| `GET /magic-links/verify/{token}` | público | Valida, marca usado y devuelve un `access_token` |

## Empresas — `/companies`
| Método y ruta | Permiso | Qué hace | Servicio |
|---|---|---|---|
| `GET /companies/` | `CompanyViewer` (`company:ver`) | Lista (filtros: `company_type`, `include_inactive`, `verification_status`); agrega `needs_action` | `get_companies` |
| `GET /companies/{id}` · `GET /companies/code/{client_code}` | `CompanyViewer` | Detalle | `get_company_by_id/_by_client_code` |
| `POST /companies/` | `CompanyManager` (`company:gestionar`) | Crea en borrador | `create_a_company` |
| `PUT /companies/{id}` | `CompanyManager` | Edita campos de la lista blanca | `edit_company` |
| `PATCH /companies/{id}/submit` | `CompanyManager` | draft → pending (exige documentos + listas + rep. legal) | `submit_company` |
| `PATCH /companies/{id}/verify` | `CompanyApprover` (`company:aprobar`) | Aprueba o rechaza una `pending` | `verify_company` |
| `PATCH /companies/{id}/resubmit` | `CompanyManager` | rejected(documents) → pending | `resubmit_company` |
| `PATCH /companies/{id}` | `CompanyManager` | **Desactiva** (cuerpo: motivo) | `deactivate_company` |
| `PATCH /companies/{id}/reactivate` | `CompanyManager` | Reactiva; `require_update=true` obliga a reemplazar documentos | `reactivate_company` |

> Desactivar/reactivar una empresa que ya salió de borrador requiere además el permiso `company:desactivar` (solo admin lo tiene vía `*`).

## Verificaciones en listas — `/compliance-checks`
| `GET /compliance-checks/company/{id}` | `CompanyViewer` | Lista las consultas de la empresa |
|---|---|---|
| `PUT /compliance-checks/company/{id}/{check_key}?subject=company\|legal_representative` | `CompanyManager` | Crea o actualiza una consulta (solo en borrador) |

## Documentos de empresa — `/documents`
| `GET /documents/?company_id=` | `DocumentViewer` (`document:ver`) | Lista documentos de una empresa |
|---|---|---|
| `POST /documents/{company_id}` | `DocumentUploader` (`document:subir`) | Sube un documento (form: `document_type`, `file`) |
| `PUT /documents/{document_id}` | `DocumentUploader` | Reemplaza el archivo (vuelve a `pending`) |
| `PATCH /documents/{document_id}/status` | `DocumentReviewer` (`document:revisar`) | Aprueba o rechaza |

## Productos — `/products`
| `GET /products/` · `GET /products/{id}` | `CurrentUser` | Solo productos activos |
|---|---|---|
| `POST /products/` · `PUT /products/{id}` | `ProductManager` (`product:gestionar`) | Crea / edita (validan unidad y paquete) |
| `DELETE /products/{id}` | `ProductManager` | Desactiva |

## Inventario — `/inventory`
| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `GET /inventory/products/{id}/stock` | `StockViewerAny` (`inventory:ver` o `order:crear`) | `physical`, `reserved`, `available`, `current_stock` (vendible; para paquetes ya dividido) |
| `GET /inventory/products/{id}/movements` | `InventoryViewer` | Historial de movimientos |
| `GET /inventory/products/{id}/kardex?start_date=&end_date=` | `InventoryViewer` | Saldo inicial, entradas, salidas, ajustes, saldo final, reservado, disponible |
| `POST /inventory/movements` | `InventoryManager` | Crea `entrada` o `ajuste` (la `salida` solo la crea el sistema) |

## Pedidos — `/orders`
| Método y ruta | Permiso | Qué hace | Servicio |
|---|---|---|---|
| `GET /orders/` | `OrderViewerAny` | Lista según rol; agrega `needs_action` | `get_orders` |
| `GET /orders/{id}` | `OrderViewerAny` | Detalle con saldos por producto; 404 si es ajeno | `get_order_by_id`, `attach_item_balances` |
| `POST /orders/` | `OrderCreator` (`order:crear`) | Crea | `create_order` |
| `PUT /orders/{id}` | `OrderCreator` | Edita (solo `created` y sin proforma) | `edit_order` |
| `POST /orders/{id}/cancel` | `OrderCanceller` (`order:anular`) | Anula con motivo | `cancel_order` |

## Pagos — `/payments`
| Método y ruta | Permiso | Qué hace | Servicio |
|---|---|---|---|
| `GET /payments/` | `PaymentViewer` | Todos los pagos | `get_payments` |
| `GET /payments/order/{order_id}` | `PaymentViewerAny` | Pago de un pedido (404 si el pedido es ajeno) | `get_payment_by_order` |
| `POST /payments/` | `PaymentCreator` | Crea la proforma (+PDF) | `create_payment` |
| `POST /payments/{id}/receipt` | `PaymentReceiptUploader` | Sube/reemplaza comprobante | `upload_receipt` |
| `POST /payments/{id}/confirm` | `PaymentConfirmer` (`payment:confirmar`) | `confirmed` (factura) o `failed` (con motivo) | `confirm_payment` |
| `GET /payments/{id}/proforma` | `PaymentViewerAny` | Descarga el PDF | — |

## Facturas — `/invoices`
| `GET /invoices/order/{order_id}` | `InvoiceViewerAny` | Factura del pedido |
|---|---|---|
| `GET /invoices/{id}/pdf` · `/xml` | `InvoiceViewerAny` | Descarga (el XML hoy siempre da 404) |

## Cuentas bancarias — `/bank-accounts`
`GET /` y `GET /{id}` (`BankAccountViewer`; clientes ven solo activas) · `POST /`, `PUT /{id}`, `DELETE /{id}` (desactiva),
`PATCH /{id}/reactivate` (`BankAccountManager`).

## Retiros / transporte — `/assignments`
| Método y ruta | Permiso | Qué hace | Servicio |
|---|---|---|---|
| `GET /assignments/lookup/owner?document_type=&document_id=` | `AssignmentLookup` | Autocompleta datos del dueño (`found/not_found/blocked`) | `lookup_owner` |
| `GET /assignments/lookup/vehicle?plate=` · `/lookup/carrier?document_type=&document_id=` | `AssignmentLookup` | Ídem para vehículo / transportador | `lookup_vehicle`, `lookup_carrier` |
| `GET /assignments/` | `AssignmentViewer` | Todos los retiros | `get_assignments` |
| `GET /assignments/order/{order_id}` | `AssignmentViewerAny` | Retiros de un pedido (oculta consultas sensibles al cliente) | `get_assignments_by_order` |
| `POST /assignments/` | `AssignmentCreatorOwn` (`assignment:crear_propio`) | Registra un retiro | `create_assignment` |
| `POST /assignments/{id}/documents` | `AssignmentCreatorOwn` | Sube/reemplaza documento (form: `subject`, `document_type`, `file`, `expires_at`) | `upload_transport_document` |
| `GET /assignments/{id}/documents/{doc}/file` | `AssignmentViewerAny` | Descarga documento | `get_transport_document` |
| `PUT /assignments/{id}/resubmit` | `AssignmentCreatorOwn` | Reenvío tras rechazo | `resubmit_assignment` |
| `PATCH /assignments/{id}/validate` | `AssignmentValidator` (`assignment:validar`) | Aprueba/rechaza + consultas + veto | `validate_assignment` |
| `PATCH /assignments/{id}/documents/{doc}/review` | `AssignmentValidator` | Aprueba/rechaza un documento | `review_transport_document` |
| `PUT /assignments/{id}/correct` | `AssignmentCorrector` (`assignment:corregir`) | Cambia quién recoge | `correct_assignment` |
| `POST /assignments/{id}/cancel` | `AssignmentCorrector` | Anula el retiro | `cancel_assignment` |
| `POST /assignments/{id}/complete-review` | `AssignmentValidator` | Cierra revisión pendiente | `complete_post_review` |

## Guías de despacho — `/dispatch-guides`
| `GET /dispatch-guides/` | `DispatchGuideViewer` | Todas |
|---|---|---|
| `GET /dispatch-guides/order/{order_id}` | `DispatchGuideViewerAny` | Las de un pedido (una por retiro) |
| `POST /dispatch-guides/` | `DispatchGuideCreator` | Genera la guía + QR de un retiro aprobado |
| `GET /dispatch-guides/verify/{token}` | `GuideVerifier` (`dispatch_guide:verificar`) | Consulta sin cambiar nada |
| `POST /dispatch-guides/verify/{token}/entry` | `GuideVerifier` | Registra ingreso |
| `POST /dispatch-guides/verify/{token}/exit` | `GuideVerifier` | Registra salida y descuenta inventario |

## Transporte directo (poco usado)
- `/vehicles` (`VehicleViewer`/`VehicleManager`): lista, detalle, crea, edita, sube y lista documentos.
- `/carriers` (`CarrierViewer`/`CarrierManager`): ídem + `DELETE` que desactiva.
- `/vehicle-types`: `GET /` (cualquier sesión), `POST /` y `PATCH /{id}` (`VehicleTypeManager`).
- `/document-blacklist` (`BlacklistManager`): `GET /`, `POST /` (veta y desactiva transportadores con ese documento), `DELETE /{id}` (des-veta).

## Otros
- `GET /admin/pending-tasks` (`AdminOnly`): empresas por aprobar.
- `GET /` → `{"status":"ok"}` (salud).
- `GET /uploads/...` → archivos estáticos (ver advertencia de seguridad en [docs/03](../../docs/03-arquitectura.md)).
