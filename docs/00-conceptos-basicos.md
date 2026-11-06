# 00 · Conceptos básicos (para quien nunca ha usado Python)

Este documento explica, con ejemplos **de este mismo proyecto**, las ideas que necesitas para leer el código.
Si ya manejas FastAPI/SQLAlchemy/React, pasa al [01](01-vision-y-estado.md).

## 1. ¿Cómo funciona el sistema en una frase?

El **navegador** (React) muestra pantallas y, cuando el usuario hace algo, manda una **petición HTTP** al
**backend** (FastAPI). El backend revisa quién es el usuario y si tiene permiso, ejecuta la regla de negocio, guarda o
lee en la **base de datos** (PostgreSQL) y responde con datos en formato JSON. React pinta esa respuesta.

```
Navegador (React)  ──HTTP/JSON──▶  FastAPI  ──SQL──▶  PostgreSQL (Neon)
   :5173                             :8000
                                       └──▶ carpeta uploads/ (PDF, imágenes, QR)
```

## 2. Python en 5 minutos

- **Entorno virtual (`venv`)**: una carpeta con las librerías de ESTE proyecto, para no mezclarlas con las de otros.
  Se activa con `source venv/bin/activate`. Si ves `(venv)` al inicio de la terminal, está activo. Si no lo
  activas, comandos como `alembic` o `uvicorn` darán "command not found".
- **`requirements.txt`**: lista de librerías y versiones. `pip install -r requirements.txt` las instala.
- **Indentación**: en Python la sangría (espacios al inicio) *es* la sintaxis; define qué líneas pertenecen a un
  `if`, un `for` o una función. En este proyecto se usan 2 espacios en la mayoría de archivos (4 en algunos).
- **Funciones y tipos**: `def get_order_by_id(db: Session, order_id: UUID) -> Optional[Order]:` significa
  "función que recibe una sesión de base de datos y un id, y devuelve un pedido o `None`". Los tipos son
  orientativos (ayudan al editor y a FastAPI), Python no los obliga.
- **`Optional[X]`** = "X o None". No se usa `X | None` porque el proyecto corre en Python 3.9.
- **Excepciones**: `raise ValueError("mensaje")` interrumpe la función y avisa un error. Es la forma en que los
  *servicios* de este proyecto rechazan algo ("el pago ya fue procesado"). El *router* la atrapa (ver §5).
- **Diccionarios y comprensiones**: `{p.order_id: p for p in pagos}` crea un diccionario `id → pago`. Se usa
  mucho para evitar consultar la base de datos dentro de un ciclo.
- **`import`**: `from app.models.order import Order` trae la clase `Order` del archivo `app/models/order.py`.

## 3. FastAPI: de una petición a una función

Un **endpoint** es una función Python decorada con la ruta que atiende:

```python
@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel(order_id: UUID, data: OrderCancel, current_user: OrderCanceller, db: Session = Depends(get_db)):
    ...
```

- `@router.post(...)`: responde a `POST /orders/{order_id}/cancel`.
- `order_id: UUID`: viene en la URL; FastAPI valida que sea un UUID.
- `data: OrderCancel`: viene en el cuerpo JSON; FastAPI lo valida con el *schema* `OrderCancel`.
- `current_user: OrderCanceller`: **inyección de dependencias**. Antes de entrar a la función, FastAPI ejecuta
  `get_current_user` (lee el token JWT) y comprueba el permiso `order:anular`. Si falla, responde 401/403 y la
  función ni se ejecuta. Si pasa, `current_user` es el usuario autenticado.
- `db: Session = Depends(get_db)`: FastAPI abre una sesión de base de datos para esta petición y la cierra al terminar.
- **Swagger** (`/docs`): FastAPI genera una página con todos los endpoints donde puedes probarlos sin frontend.
  Para autenticarte allí: haz `POST /auth/login`, copia el `access_token` y pégalo en el botón **Authorize**.

## 4. Las capas del backend (y por qué existen)

| Capa | Carpeta | Responsabilidad | Ejemplo |
|------|---------|-----------------|---------|
| Modelo | `app/models/` | Define **una tabla** de la base de datos | `Order` → tabla `orders` |
| Schema | `app/schemas/` | Define la forma del JSON que entra y sale, y lo valida | `OrderCreate`, `OrderResponse` |
| Servicio | `app/services/` | **Reglas de negocio** (no sabe de HTTP) | `create_order`, `confirm_payment` |
| Router | `app/routers/` | Recibe la petición, comprueba permisos, llama al servicio y traduce errores a HTTP | `routers/order.py` |
| Constantes | `app/constants/` | Reglas fijas: permisos por rol, documentos requeridos | `permissions.py` |

**Regla de oro**: la lógica va en el servicio; el router solo "conecta". Así una regla se escribe una vez.

## 5. Cómo se manejan los errores (¡importante!)

1. El **servicio** detecta algo inválido y hace `raise ValueError("Mensaje en español")`.
2. El **router** lo atrapa con `try/except ValueError`, hace `db.rollback()` (deshacer cambios a medias) y responde
   `HTTPException(status_code=400, detail="Mensaje")`.
3. El **frontend** muestra `detail` en un aviso (toast).

> Si una excepción **no** se atrapa, FastAPI responde 500 *sin* las cabeceras de CORS, y el navegador muestra un
> genérico **"Network Error"** que no dice nada útil. Si ves "Network Error" en la interfaz, mira la terminal del
> backend: allí está el error real.

Otra convención: si alguien pide un pedido ajeno, se responde **404** (no 403) para no revelar que existe.

## 6. SQLAlchemy: la base de datos como objetos Python

Un modelo es una clase:

```python
class Payment(Base, AuditMixin):
    __tablename__ = "payments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID, ForeignKey("orders.id"), unique=True, nullable=False)
    status = Column(String, nullable=False, default="pending")
```

Se consulta con la **sesión** `db`:

```python
db.query(Payment).filter(Payment.order_id == order_id).first()   # SELECT ... WHERE ... LIMIT 1
db.add(nuevo)        # prepara un INSERT
db.flush()           # envía el INSERT a la base pero SIN cerrar la transacción (el objeto ya tiene id)
db.commit()          # confirma TODO lo pendiente
db.rollback()        # deshace TODO lo pendiente desde el último commit
db.refresh(obj)      # vuelve a leer el objeto de la base
```

Idea clave, **transacción**: varios cambios se guardan "todos o ninguno". Ejemplo real: al confirmar un pago se
cambia el pago, se crea la factura y se cambia el pedido en una sola transacción; si falla la factura, `rollback()`
deja todo como estaba.

Términos: `nullable=False` (obligatorio), `unique=True` (no se repite), `ForeignKey` (apunta a otra tabla),
`UUID` (identificador largo aleatorio, por ejemplo `3f2b...`; se usa en vez de 1, 2, 3…).

## 7. Alembic: migraciones (cambiar la base de datos con seguridad)

Cambiar un modelo Python **no** cambia la base. Para eso hay migraciones: archivos en `Backend/alembic/versions/`
que dicen "crea esta tabla / agrega esta columna". Cada una apunta a la anterior (`down_revision`), formando una
cadena; la última es el *head* (hoy: `caffaa585f24_partial_dispatches`).

| Comando (desde `Backend/`, con venv) | Qué hace |
|---|---|
| `alembic upgrade head` | Aplica las migraciones pendientes |
| `alembic revision --autogenerate -m "mensaje"` | Genera una migración comparando modelos vs base |
| `alembic current` / `alembic heads` | Qué versión tiene la base / cuál es la última del código |
| `alembic check` | Debe decir "No new upgrade operations detected" cuando modelos y base coinciden |

**Reglas de oro de este proyecto** (también en [CLAUDE.md](../CLAUDE.md)):
1. **Nunca** usar autogenerate para *renombrar* tablas o columnas: genera "borrar + crear" y se pierden los datos.
   Se escribe a mano `op.rename_table(...)` / `op.alter_column(..., new_column_name=...)`.
2. **Nunca** editar una migración ya aplicada; se crea una nueva.
3. **Guardar el archivo antes** de `alembic upgrade head`. Si no aparece la línea `Running upgrade`, Alembic marcó la
   versión sin ejecutar nada: se arregla con `alembic stamp <revisión_anterior>` y se vuelve a correr.
4. Después de cada migración, `alembic check`.
5. Antes de crear una restricción `unique`, buscar duplicados con SQL.

## 8. JWT, login y permisos

- **Login**: `POST /auth/login` con `document_id` + `password`. Si son correctos devuelve un **token JWT**
  (texto firmado que contiene el documento del usuario, su rol y la fecha de vencimiento). El frontend lo guarda en
  `localStorage` y lo manda en cada petición (`Authorization: Bearer <token>`), ver `services/api.js`.
- **Contraseñas**: nunca se guardan; se guarda un *hash* bcrypt (`hashed_password`).
- **Rol → permisos**: `constants/permissions.py` mapea cada rol a un conjunto de permisos con forma
  `recurso:acción` (`payment:confirmar`). `admin` tiene `"*"` (todo).
- **Magic link**: enlace de un solo uso (48 h) que inicia sesión a un usuario *cliente* sin contraseña.
  Lo genera un administrador (`POST /magic-links/`).

## 9. React en 5 minutos

- **Componente**: una función que devuelve JSX (HTML dentro de JavaScript): `function Orders() { return <div>…</div> }`.
- **Estado** (`useState`): datos que, al cambiar, vuelven a pintar el componente.
- **Efectos** (`useEffect`): código que corre al montar el componente; aquí se cargan datos de la API.
- **Props**: parámetros que un componente padre pasa a un hijo (`<PaymentCard order={order} onChanged={reload} />`).
- **Contexto** (`createContext`): estado compartido por toda la app. Aquí: `AuthContext` (usuario y permisos) y
  `ToastContext` (avisos).
- **Rutas** (`react-router-dom`): `App.jsx` dice qué componente se muestra en cada URL.
- **Vite**: el servidor de desarrollo (`npm run dev`).
- **Permisos en la interfaz**: `hasPermission('payment:confirmar')` decide si se muestra un botón. **Es solo
  cosmético**; la seguridad real está en el backend.

## 10. Glosario del negocio

| Término | Significado en este sistema |
|---------|-----------------------------|
| **Pedido (PED-AAAA-NNNN)** | Orden de compra de un cliente (`orders`). |
| **Proforma (PRO-AAAA-NNNN)** | Documento PDF con los datos de pago (cuenta bancaria, valor). Se numera igual que el pedido. |
| **Comprobante** | Foto/PDF de la consignación que sube el cliente. |
| **Factura** | Se emite al confirmar el pago, con un proveedor **simulado** (datos DIAN marcados `PRUEBA`; sin validez fiscal). |
| **Retiro (Assignment)** | Una recogida concreta de mercancía de un pedido: qué cantidades, qué vehículo y qué transportador. Un pedido puede tener **varios retiros** (despacho parcial). |
| **Transporte de terceros** | El cliente trae su propio vehículo/conductor; Logística los valida con documentos (SOAT, licencia…) y consultas en listas. |
| **Guía de despacho** | Documento con QR, una por retiro aprobado. En portería se escanea para registrar ingreso y salida. |
| **Portería** | Rol que solo escanea guías. |
| **Kardex** | Reporte de inventario de un periodo: saldo inicial, entradas, salidas, ajustes, saldo final. |
| **Reservado / disponible / físico** | Físico = lo que hay en bodega; reservado = lo ya vendido y no despachado; disponible = físico − reservado. |
| **Producto base / paquete** | Un paquete (ej. "caja x24") es un producto hijo que apunta a un producto base; el inventario vive en el base. |
| **Listas vinculantes** | Consultas de cumplimiento (lavado de activos, antecedentes…) que se hacen a empresas y transportadores. |
| **Lista negra** | Documentos/placas vetados (`document_blacklist`). |
| **NIT / CC / CE / PP / PPT / PEP** | Tipos de documento de identidad colombianos. |
| **CIIU** | Código de actividad económica (4 dígitos). |
| **RUT / DIAN / CUFE** | Registro tributario / autoridad de impuestos / código único de factura electrónica. En este proyecto son simulados. |
