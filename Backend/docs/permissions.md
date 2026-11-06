# Roles y permisos

## Cómo funciona (resumen)

1. El usuario tiene un `role` (texto en `users.role`).
2. [constants/permissions.py](../app/constants/permissions.py) → `ROLES_PERMISSIONS` dice qué permisos tiene cada rol.
   `admin` tiene `"*"` y pasa cualquier chequeo.
3. Cada endpoint declara el permiso que exige mediante un tipo de [auth_dependencies.py](../app/auth_dependencies.py)
   (por ejemplo `current_user: PaymentConfirmer`).
4. El frontend recibe la lista de permisos del rol en `GET /users/me` y la usa con `hasPermission('...')` solo para
   mostrar u ocultar botones. **La seguridad real está en el backend.**

Convención de nombre: `recurso:accion` (`payment:confirmar`, `order:ver_todos`). Se agrupan acciones que siempre van
juntas (`product:gestionar` = crear + editar + desactivar) y se separan cuando algún rol necesita una sin la otra
(`payment:crear` vs `payment:confirmar`).

## Las funciones base ([dependencies.py](../app/dependencies.py))

- **`get_current_user`**: decodifica el JWT, **vuelve a leer al usuario de la base** (por `document_id`), exige que esté
  activo y que su empresa no esté desactivada (si lo está → 403 "Tu empresa está desactivada…"). El `role` del token se ignora.
- **`require_permission(p)`**: exige exactamente `p` (o `"*"`). Uso normal.
- **`require_any_permission(*ps)`**: exige al menos uno. Se usa cuando varios roles entran al mismo endpoint con alcance
  distinto (ver todo vs ver lo propio) y el filtrado ocurre dentro de la función.
- **`user_has_permission(user, p)`**: devuelve `bool` sin cortar la petición; para lógica condicional dentro de un endpoint o servicio.
- `require_role(*roles)`: **legado**, no usar.

**Regla de orden de parámetros:** en una función, los parámetros `Annotated` (sin `=`) van **antes** que los que tienen
valor por defecto (`db: Session = Depends(get_db)`). Si no, Python da `SyntaxError`.

## Matriz de permisos por rol (según `ROLES_PERMISSIONS`)

`✔` = lo tiene. `admin` tiene todo por el comodín `*`. Los permisos que **solo** admin tiene: `user:gestionar`,
`company:aprobar`, `company:desactivar`, `order:anular`, `document:revisar`, `vehicle_type:gestionar` (ver "Permisos sin dueño" abajo).

| Permiso | cartera | logística | operaciones | soporte | cliente_admin | cliente_operativo | portería |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `order:crear` | | | | | ✔ | ✔ | |
| `order:ver_todos` | ✔ | ✔ | ✔ | ✔ | | | |
| `order:ver_empresa` | | | | | ✔ | | |
| `order:ver_propios` | | | | | | ✔ | |
| `order:editar_propio` | | | | | ✔ | ✔ | |
| `order:editar_limitado` | | | | ✔ | | | |
| `payment:crear` | ✔ | | | | | | |
| `payment:crear_propio` | | | | | ✔ | ✔ | |
| `payment:confirmar` | ✔ | | | | | | |
| `payment:ver` | ✔ | ✔ | | ✔ | | | |
| `payment:ver_propio` | | | | | ✔ | ✔ | |
| `payment:subir_comprobante` | | | | | ✔ | ✔ | |
| `bank_account:gestionar` | ✔ | | | | | | |
| `bank_account:ver` | ✔ | | | | ✔ | ✔ | |
| `invoice:emitir` | ✔ | | | | | | |
| `invoice:ver` | ✔ | ✔ | | ✔ | | | |
| `invoice:ver_propio` | | | | | ✔ | ✔ | |
| `company:gestionar` | | | ✔ | ✔ | | | |
| `company:ver` | ✔ | | ✔ | ✔ | | | |
| `document:subir` | | | ✔ | | | | |
| `document:ver` | ✔ | | ✔ | ✔ | | | |
| `product:gestionar` | | | ✔ | | | | |
| `inventory:gestionar` | | | ✔ | | | | |
| `inventory:ver` | | | ✔ | | | | |
| `vehicle:gestionar` / `carrier:gestionar` | | ✔ | | | | | |
| `vehicle:ver` / `carrier:ver` | | ✔ | ✔ | | | | |
| `assignment:validar` | | ✔ | | | | | |
| `assignment:corregir` | | ✔ | | | | | |
| `assignment:ver` | | ✔ | | ✔ | | | |
| `assignment:crear_propio` | | | | | ✔ | ✔ | |
| `assignment:ver_propio` | | | | | ✔ | ✔ | |
| `dispatch_guide:crear` | | ✔ | | | | | |
| `dispatch_guide:ver` | | ✔ | | ✔ | | | |
| `dispatch_guide:ver_propio` | | | | | ✔ | ✔ | |
| `dispatch_guide:verificar` | | | | | | | ✔ |
| `blacklist:gestionar` | | ✔ | | | | | |

### Permisos sin dueño explícito (solo los alcanza `admin`)
Existen en `auth_dependencies.py` o en el código pero ningún rol (salvo `admin`) los tiene en `ROLES_PERMISSIONS`:
`user:gestionar`, `company:aprobar`, `company:desactivar`, `order:anular`, `document:revisar`,
`vehicle_type:gestionar`. **Consecuencias**:
- `document:revisar` solo lo tiene admin, aunque el comentario de `roles.py` diga que operaciones revisa documentos.
- `vehicle_type:gestionar` también (aunque `operaciones`/`logística` podrían necesitarlo).
- Los clientes no pueden anular sus pedidos (`order:anular`).
Si el negocio quiere otro reparto, se cambia **solo** `ROLES_PERMISSIONS`; no hay migración (el rol es un texto).

## Cómo agregar un permiso o rol nuevo
1. Agrega el permiso a los roles que lo necesiten en `ROLES_PERMISSIONS`.
2. Crea su tipo en `auth_dependencies.py`: `MiPermiso = Annotated[User, Depends(require_permission("recurso:accion"))]`.
3. Úsalo en el endpoint: `def mi_endpoint(current_user: MiPermiso, db: Session = Depends(get_db)):`.
4. Si la interfaz lo necesita: `hasPermission('recurso:accion')`.
5. Rol nuevo = nueva entrada en `ROLES_PERMISSIONS` (y agregar el nombre a las listas del frontend que filtren por rol, si las hay).

## Endpoints sin sesión (públicos)
Solo tres, por diseño (quien los llama aún no tiene sesión):
- `POST /auth/login`
- `GET /magic-links/verify/{token}`
- `GET /` (salud)

> ℹ️ La documentación anterior listaba `GET /dispatch-guides/verify/{token}` como público. **Ya no lo es**: exige el
> permiso `dispatch_guide:verificar` (portería o admin).

## Reglas de acceso a datos más allá del permiso
Algunos endpoints añaden un filtro dentro de la función:
- **Pedidos y todo lo que cuelga de ellos** (pagos, facturas, retiros, guías): `can_access_order`. Ajeno → 404.
- **Cuentas bancarias**: los roles cliente solo ven las activas.
- **Búsquedas de ayuda de transporte** (`/assignments/lookup/*`): un cliente solo recibe datos de vehículos/personas que su empresa ya usó.
- **Consultas sensibles** (`listas_vinculantes`): se ocultan a los clientes.
- **Subida de documentos de transporte**: quien tiene `assignment:validar` no puede subirlos.
