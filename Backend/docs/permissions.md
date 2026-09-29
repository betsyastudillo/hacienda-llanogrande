# Roles y permisos

## Dos sistemas conviviendo — cuál usar

El proyecto empezó con `require_role()` (roles fijos por endpoint) y migró a un sistema de **permisos granulares** (`require_permission()`). `constants/roles.py` y `require_role()` son el sistema **legado**: quedan porque algunos routers viejos podrían no haberlos migrado nunca, pero **todo código nuevo usa el sistema de permisos**, nunca `require_role()`.

## `constants/permissions.py` — la fuente de verdad

```python
ROLES_PERMISSIONS = {
    "admin": {"*"},  # comodín: pasa cualquier chequeo, sin listar cada permiso
    "cartera": {"payment:crear", "payment:confirmar", ...},
    "logistica": {"vehicle:gestionar", "assignment:validar", ...},
    ...
}
```

Convención de nombre de permiso: `"recurso:accion"` (`payment:crear`, `order:ver_todos`). Cuando varias acciones de escritura siempre van juntas para todos los roles que las tienen, se agrupan en un solo permiso (`material:gestionar` cubre crear+editar+eliminar) — separar solo cuando ya se sabe hoy que algún rol necesita una sin la otra (ej. `payment:crear` vs `payment:confirmar`, porque `cliente_operativo` puede crear un pago pero nunca confirmarlo).

## `dependencies.py` — las tres funciones base

- **`require_permission(permission)`** — exige exactamente ese permiso (o el comodín). Uso normal, un solo chequeo claro.
- **`require_any_permission(*permissions)`** — exige al menos uno de varios. Se usa cuando el mismo endpoint debe aceptar tanto a quien ve "todo" como a quien ve "solo lo propio" (ej. `payment:ver` vs `payment:ver_propio`), y el filtrado real ocurre *dentro* de la función, no en la puerta de entrada.
- **`user_has_permission(user, permission)`** — no lanza excepción, devuelve `bool`. Se usa **dentro** de un service/router ya autorizado, para decidir lógica condicional (ej. "¿filtro por empresa o muestro todo?"), nunca como reemplazo de las dos funciones anteriores.

## `auth_dependencies.py` — tipos reutilizables

En vez de escribir `Depends(require_permission("payment:crear"))` en cada endpoint (fácil de equivocar, como el bug real que costó una sesión completa por olvidar el `*` al desempaquetar una tupla), cada combinación de permiso vive una sola vez como un tipo:

```python
PaymentCreator = Annotated[User, Depends(require_permission("payment:crear"))]
```

Y el endpoint solo lo usa como cualquier otro parámetro tipado:

```python
def create_new_payment(data: PaymentCreate, current_user: PaymentCreator, db: Session = Depends(get_db)):
```

**Regla de orden de parámetros que rompe si se ignora**: los parámetros `Annotated` (sin `=`) deben ir **antes** que los que tienen valor por defecto (`db: Session = Depends(get_db)`). Poner `current_user: PaymentCreator` después de `db` es un `SyntaxError` de Python, no un error de FastAPI — pasó varias veces durante el desarrollo hasta que se volvió costumbre.

## Roles actuales

**Empresa propia (Hacienda):** `admin` (todo, vía comodín), `logistica` (transporte, vehículos, guías de despacho), `cartera` (pagos, cuentas bancarias), `operaciones` (catálogo de productos, revisión de documentos), `soporte` (consulta amplia, edición limitada de pedidos).

**Empresa cliente:** `cliente_admin` (ve todos los pedidos de su empresa), `cliente_operativo` (ve y crea solo los suyos).

Ningún rol nuevo (ej. "control interno", pendiente para el módulo de inventario) existe todavía — se crea agregando una entrada a `ROLES_PERMISSIONS` y, si aplica, un tipo nuevo en `auth_dependencies.py`. No requiere ninguna migración de base de datos, porque el rol es solo un string en `User.role`.

## Endpoints públicos (sin ningún `require_*`)

Solo dos en todo el sistema, y ambos por diseño, no por descuido:

- `POST /auth/login`
- `GET /dispatch-guides/verify/{token}`
- `GET /magic-links/verify/{token}`

Los tres comparten el mismo motivo: quien los llama, por definición, todavía no tiene sesión iniciada.
