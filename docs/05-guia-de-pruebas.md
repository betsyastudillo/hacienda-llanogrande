# 05 · Guía de pruebas manuales

No hay pruebas automatizadas. Todo se prueba con **Swagger** (`http://localhost:8000/docs`), **consultas SQL** en
la consola de Neon y la **interfaz** (`http://localhost:5173`).

Antes de empezar: backend y frontend corriendo, `alembic current` igual a `alembic heads`.

## Cómo usar Swagger con sesión
1. `POST /auth/login` con `{"document_id": "...", "password": "..."}` → copia `access_token`.
2. Botón **Authorize** (arriba a la derecha) → pega el token (solo el token, sin "Bearer").
3. Ya puedes ejecutar los demás endpoints. El token dura 30 min (por defecto): si ves 401, repite el login.

## 0. Datos iniciales (primer admin y empresa propia)

`POST /auth/register` exige estar logueado como admin, así que el primero se crea por script. Crea el archivo
`Backend/seed_admin.py` **(no lo subas a git con una contraseña real)** y ejecútalo desde `Backend/` con el venv activo:

```python
# Backend/seed_admin.py — uso único. Crea la empresa propia y el primer admin si no existen.
from app.database import SessionLocal
from app.models.company import Company
from app.models.user import User
from app.services.auth_service import hash_password

DOCUMENT_ID = "CAMBIAR"        # documento con el que se hará login
FULL_NAME = "Administrador"
PASSWORD = "CAMBIAR"           # elegir una contraseña real

db = SessionLocal()
own = db.query(Company).filter(Company.company_type == "own").first()
if not own:
    own = Company(
        client_code="HAC-0001", legal_name="Hacienda Llanogrande",
        document_type="NIT", document_number="CAMBIAR",
        company_type="own", person_type="juridica",
        address="CAMBIAR (mín. 8 caracteres)", phone="3000000000", email="contacto@ejemplo.com",
        city="CAMBIAR", department="CAMBIAR", country="Colombia",
        verification_status="approved",
    )
    db.add(own); db.flush()

if not db.query(User).filter(User.document_id == DOCUMENT_ID).first():
    db.add(User(document_id=DOCUMENT_ID, full_name=FULL_NAME,
                hashed_password=hash_password(PASSWORD), role="admin",
                company_id=own.id, is_active=True))
db.commit()
print("Listo")
```

```bash
cd Backend && source venv/bin/activate && python seed_admin.py
```

Verifica en Neon: `SELECT document_id, role, is_active FROM users;` y `SELECT client_code, company_type FROM companies;`.

> La empresa propia es obligatoria para: crear cuentas bancarias, generar guías de despacho (origen = su dirección) y
> el PDF de proforma/factura (datos del vendedor).

Datos mínimos para recorrer todo el flujo (créalos con admin): una cuenta bancaria, un producto base con entrada de
inventario, una empresa cliente **aprobada**, un usuario `cliente_admin` de esa empresa, un usuario `cartera`, uno
`logistica` y uno `porteria`, y al menos un tipo de vehículo.

---

## 1. Autenticación y sesión
| Probar | Cómo | Esperado |
|---|---|---|
| Login correcto | `POST /auth/login` | 200 y `access_token` |
| Login incorrecto | contraseña mala | 401 `Invalid document ID or password` |
| Empresa desactivada | desactiva la empresa de un cliente y haz login | 403 "Tu empresa está desactivada…" |
| Perfil | `GET /users/me` | incluye `permissions` (lo usa el frontend) |
| Renovar | `POST /auth/refresh` | nuevo token |
| Interfaz | espera a que falten 2 min | aparece el aviso para renovar la sesión; al vencer vuelve a `/login` con mensaje |
| Magic link | admin: `POST /magic-links/` con el `user_id` de un cliente → abrir `http://localhost:5173/link-login?token=<token>` | **Hoy fallará estando sin sesión** (la ruta `/link-login` está protegida; ver [06](06-pendientes-y-decisiones.md) §2). Si ya hay una sesión abierta, entra y lo lleva a `/orders/new`; reusar el enlace da error "already used" |

## 2. Empresas (rol operaciones/admin)
1. `POST /companies/` (o `/companies/new` en la interfaz) → estado `draft`, `client_code` `CLI-000N`.
2. Sube los documentos requeridos (`POST /documents/{company_id}`): jurídica = `camara_comercio`, `rut`, `cedula_representante`.
3. Registra **todas** las consultas: `PUT /compliance-checks/company/{id}/{check_key}` con cuerpo
   `{"has_findings": false, "note": null}`. El sujeto va como **parámetro de la URL** (`?subject=company`, por defecto, o
   `?subject=legal_representative` para el representante legal). Si `has_findings=true`, la nota es obligatoria.
4. `PATCH /companies/{id}/submit` → `pending`. Prueba que falle si falta algo (mensaje dice qué falta).
5. Como admin: `PATCH /companies/{id}/verify` `{"decision":"approved"}` → `approved`.
6. Rechazo: `{"decision":"rejected","rejection_type":"documents","rejection_reason":"…"}` → luego reemplaza el documento
   rechazado y `PATCH /companies/{id}/resubmit`. Con `rejection_type":"compliance"` el rechazo es definitivo.
7. SQL: `SELECT client_code, verification_status, rejection_type FROM companies ORDER BY created_at DESC;`

## 3. Productos e inventario
- Crear producto base (`POST /products/`), luego un paquete con `parent_product_id` + `units_per_pack`.
- Entrada: `POST /inventory/movements` `{"product_id":…, "movement_type":"entrada","quantity":100,"reason":"Cosecha"}`.
- Stock: `GET /inventory/products/{id}/stock` → `physical`, `reserved`, `available`, `current_stock` (vendible).
- Ajuste por daño: `movement_type":"ajuste","category":"damage","quantity":5` → se guarda **−5** automáticamente.
- Kardex: `GET /inventory/products/{id}/kardex?start_date=2026-11-01&end_date=2026-11-30`.
- Intentar un movimiento sobre un **paquete** debe fallar; no existe forma de borrar un movimiento (a propósito).
- SQL: `SELECT movement_type, quantity, reason, order_id FROM inventory_movements WHERE product_id='…' ORDER BY created_at;`

## 4. Pedido
1. Login como `cliente_admin` → `POST /orders/` con `items:[{product_id, quantity_m3: 10}]`.
   Esperado: `order_number` `PED-2026-000N`, totales = Σ(precio×cant) + IVA.
2. Pedir más que el vendible → 400 "No hay la cantidad suficiente…".
3. `GET /orders/` como `cliente_operativo`: solo ve los suyos. Pide el id de un pedido ajeno → **404**.
4. Editar: `PUT /orders/{id}` solo en `created` y sin proforma.
5. Reserva: tras crear, `GET …/stock` debe mostrar `reserved` = 10 y `physical` sin cambio (no hay movimiento aún).
6. Anular (admin): `POST /orders/{id}/cancel` `{"reason":"…"}` → `cancelled`; la reserva se libera.

## 5. Pago y factura
1. Cliente: `POST /payments/` `{"order_id","bank_account_id"}` → proforma `PRO-2026-000N`; `GET /payments/{id}/proforma` descarga el PDF.
2. Cliente: `POST /payments/{id}/receipt` (archivo pdf/jpg/png/webp ≤ 5 MB). Archivo `.txt` o > 5 MB → 400.
3. Cartera: `POST /payments/{id}/confirm`:
   - Rechazo: `{"status":"failed","reason":"No coincide el valor"}` → el pago pasa a `failed`; el cliente sube otro comprobante (vuelve a `pending`).
   - Confirmar: `{"status":"confirmed"}` → pago `confirmed`, pedido **`facturado`**, factura `issued`.
4. `GET /invoices/order/{order_id}` y `GET /invoices/{invoice_id}/pdf`: el PDF debe indicar que es una SIMULACIÓN y todo dato DIAN debe llevar `PRUEBA` (la marca de agua diagonal `_watermark` está comentada en `invoice_pdf.py`).
5. SQL: `SELECT o.order_number,o.status,p.status,i.status,i.invoice_number,left(i.cufe,12) FROM orders o JOIN payments p ON p.order_id=o.id LEFT JOIN invoices i ON i.order_id=o.id;`
6. Prueba de atomicidad (opcional): renombra temporalmente `assets/logo.png` y confirma → si el PDF falla, el pago debe seguir `pending` y el pedido `created`. Restaura el logo.

## 6. Retiro, transporte y guía
Con un pedido `facturado`:
1. Cliente: `POST /assignments/` con `order_id`, `items` (`order_item_id` + `quantity` ≤ pendiente), `vehicle`
   (placa, tipo, datos del dueño) y `carrier` (documento, nombre, teléfono 7–15 dígitos, dirección ≥ 8). Placa en lista negra → 400.
2. Cliente: sube cada documento `POST /assignments/{id}/documents` (form: `subject`=`vehicle|carrier`, `document_type`, `file`, y `expires_at` para `soat`/`licencia_conduccion`).
3. Logística: `PATCH …/documents/{doc}/review` aprueba o rechaza (con motivo) cada documento.
4. Logística: `PATCH /assignments/{id}/validate` con `decision:"approved"` y **todas** las `checks` requeridas
   (sin esto responde "Faltan consultas por registrar: …"). Un hallazgo en `listas_vinculantes` impide aprobar.
5. Rechazo: `decision:"rejected"`, `rejection_reason`, opcional `blacklist_carrier/vehicle/owner` → revisa `document_blacklist`.
6. Cliente: `PUT /assignments/{id}/resubmit` con datos corregidos → vuelve a `pending`.
7. Logística: `POST /dispatch-guides/` `{"assignment_id"}` → guía con `token` y QR en `uploads/dispatch_guides/<assignment>/qr.png`.
8. Segundo retiro: crea otro con la cantidad restante; si pides más de lo pendiente → 400. Anula uno con `POST …/cancel` y comprueba que sus cantidades vuelven a estar disponibles.
9. SQL: `SELECT sequence, validation_status, cancelled_at FROM assignments WHERE order_id='…' ORDER BY sequence;`

## 7. Portería (entrada y salida)
1. Login como `porteria` (se redirige a `/dispatch-guides/scan`). En el celular abre el sistema por la IP; el QR apunta a
   `FRONTEND_URL/dispatch-guides/verify/<token>` — por eso `FRONTEND_URL` debe tener esa IP.
2. Escanea (o abre la URL a mano) → `GET /dispatch-guides/verify/{token}` muestra datos, `can_enter`, `can_exit`.
3. `POST …/entry` → guía `in_plant`. Repetir → 400.
4. `POST …/exit` → guía `used`, **aparece un movimiento `salida` por producto**, el pedido pasa a `partially_dispatched` o
   `dispatched`. Verifica en `stock` que `physical` bajó y `reserved` bajó lo mismo (disponible igual).
5. Vetar la placa después de generar la guía → la entrada debe bloquearse; si el vehículo ya estaba dentro, la salida sí se permite.
6. SQL: `SELECT status, entered_at, used_at FROM dispatch_guides;`

## 8. Permisos (matriz rápida)
Entra con cada rol y verifica que **no** pueda: cliente → confirmar pago (403); cartera → validar transporte (403);
logística → confirmar pago (403); portería → ver `/orders` (la interfaz la manda a escanear); cliente_operativo → ver pedido de otro (404).

## 9. Comandos de revisión de base de datos
```bash
alembic current     # versión aplicada en Neon
alembic heads       # última versión en el código
alembic check       # debe decir "No new upgrade operations detected"
```
