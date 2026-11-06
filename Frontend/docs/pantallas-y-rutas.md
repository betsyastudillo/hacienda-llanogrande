# Rutas, pantallas y llamadas a la API

Todas las rutas están en [src/App.jsx](../src/App.jsx). Hay dos grupos:

- **Pública:** `/login`.
- **Protegida** (dentro de `ProtectedRoute` + `Layout`): todo lo demás. `ProtectedRoute` solo mira si hay `token`; si no,
  redirige a `/login`. `Layout` pinta `Header`, `Sidebar`, `SessionGuard`, el contenido (`<Outlet/>`) y `ScrollToTop`.
- Cualquier ruta desconocida (`*`) redirige a `/`, que a su vez usa `HomeRedirect`.

> ⚠️ `/link-login` (magic link) está por error dentro del grupo protegido ([docs/06](../../docs/06-pendientes-y-decisiones.md) #3).

## Mapa de rutas

| Ruta | Componente | Para qué | Permiso (UI) |
|---|---|---|---|
| `/login` | `pages/Login/Login` | Inicio de sesión con documento + contraseña | — |
| `/` | `components/HomeRedirect` | Si tiene permiso de ver pedidos → `/orders`; si tiene `dispatch_guide:verificar` → `/dispatch-guides/scan`; si no → `/login` | — |
| `/link-login?token=` | `pages/LinkLogin/LinkLogin` | Canjea un magic link y lleva a `/orders/new` | — |
| `/orders` | `Orders/Orders` | Listado, búsqueda, "pendientes primero", ver anulados | cualquier sesión (el backend filtra) |
| `/orders/new` | `Orders/OrderNew/OrderNew` | Crear pedido | `order:crear` |
| `/orders/:orderId/edit` | `OrderNew` (reutilizado) | Editar pedido en `created` | `order:editar_propio` |
| `/orders/:orderId` | `Orders/OrderDetail/OrderDetail` | Detalle: estado, productos, pago, factura, retiros | — |
| `/products` | `Products/Products` | Catálogo con stock | cualquier sesión |
| `/products/new`, `/products/:productId/edit` | `Products/ProductForm/ProductForm` | Crear/editar producto o paquete | `product:gestionar` |
| `/companies` | `Companies/Companies` | Listado de empresas | `company:ver` |
| `/companies/new`, `/companies/:companyId/continue` | `Companies/CompanyNew/CompanyNew` | Alta en pasos (datos → documentos → listas) y continuar un borrador | `company:gestionar` |
| `/companies/:companyId` | `Companies/CompanyDetail/CompanyDetail` (+ `EditCompanyModal`) | Detalle, revisión de documentos, aprobación | — |
| `/inventory` | `Inventory/Inventory` | Stock por producto y registro de movimientos | `inventory:ver` |
| `/inventory/:productId` | `Inventory/ProductInventory/ProductInventory` | Kardex y movimientos de un producto | `inventory:ver` |
| `banks-accounts` | `BankAccounts/BankAccounts` | CRUD de cuentas bancarias | `bank_account:gestionar` |
| `/vehicle_types` | `VehicleTypes/VehicleTypes` | CRUD de tipos de vehículo | `vehicle_type:gestionar` |
| `/dispatch-guides/scan` | `DispatchGuides/ScanGuide` | Cámara para leer el QR (librería `html5-qrcode`) o pegar enlace/código | portería |
| `/dispatch-guides/verify/:token` | `DispatchGuides/VerifyGuide` | Muestra la guía y botones Registrar entrada / salida | portería |

Notas: la ruta `banks-accounts` está sin "/" inicial en `App.jsx` (funciona, pero rompe la convención de rutas absolutas
y la URL del menú es `/banks-accounts`). El menú ([constants/menu.js](../src/constants/menu.js)) oculta cada entrada
según `permission`; las entradas comentadas (Pagos, Transporte, Guías, Vehículos, Transportistas, Documentos, Lista negra,
Usuarios) son pantallas **que no existen**.

## Qué endpoints usa cada pantalla

| Pantalla | Llamadas |
|---|---|
| Login | `POST /auth/login` |
| AuthContext | `GET /users/me` |
| SessionGuard | `POST /auth/refresh` |
| LinkLogin | `GET /magic-links/verify/{token}` |
| Orders | `GET /orders/` |
| OrderNew | `GET /products/`, `GET /inventory/products/{id}/stock`, `POST /orders/`, `PUT /orders/{id}`, `GET /orders/{id}`, `GET /payments/order/{id}` |
| OrderDetail | `GET /orders/{id}`, `/payments/order/{id}`, `/bank-accounts/{id}`, `/invoices/order/{id}`, `/assignments/order/{id}`, `/products/`, `POST /orders/{id}/cancel` |
| PaymentCard | `GET /bank-accounts/`, `POST /payments/`, `POST /payments/{id}/receipt`, `POST /payments/{id}/confirm` |
| TransportCard | `GET /assignments/lookup/{vehicle,owner,carrier}`, `POST /assignments/`, `POST …/{id}/documents`, `PATCH …/{id}/documents/{doc}/review`, `PATCH …/{id}/validate`, `PUT …/{id}/resubmit`, `PUT …/{id}/correct`, `POST …/{id}/cancel`, `POST …/{id}/complete-review`, `POST /dispatch-guides/` |
| Products / ProductForm | `GET /products/`, `GET /products/{id}`, `POST/PUT /products/`, `GET /inventory/products/{id}/stock` |
| Inventory / ProductInventory | `GET /inventory/products/{id}/stock|kardex|movements`, `POST /inventory/movements` |
| Companies / CompanyNew / CompanyDetail | `/companies/*`, `/documents/*`, `/compliance-checks/company/{id}` |
| BankAccounts | `/bank-accounts/*` |
| VehicleTypes (y hook `useVehicleTypes`) | `/vehicle-types/*` |
| ScanGuide / VerifyGuide | `GET /dispatch-guides/verify/{token}`, `POST …/entry|exit` |

## Sesión (ver también [context.md](context.md))

- Token en `localStorage['access_token']`. `api.js` lo agrega a cada petición.
- `api.js` intercepta respuestas: un **401** (salvo en login y magic link) o un **403 "desactivada"** llama al manejador
  que registra `SessionGuard`, el cual cierra sesión, guarda un mensaje en `sessionStorage['session_message']` y vuelve a `/login`.
- `SessionGuard` calcula el vencimiento real del JWT (`utils/jwt.js`); a los 120 s del final muestra un `ConfirmModal`
  con cuenta regresiva para renovar (`POST /auth/refresh`) o cerrar sesión.

## Estado y datos: patrón general de una pantalla

```jsx
const [data, setData] = useState([]);  const [loading, setLoading] = useState(true)
useEffect(() => { api.get('/ruta').then(r => setData(r.data)).finally(() => setLoading(false)) }, [])
```
No hay librería de caché (React Query, Redux): cada pantalla carga lo suyo y, tras una acción, vuelve a cargar
(`onChanged` / `reloadAll`).

## Permisos de interfaz usados con `hasPermission`
`order:crear`, `order:editar_propio`, `order:anular`, `payment:crear`, `payment:crear_propio`, `payment:subir_comprobante`,
`payment:confirmar`, `assignment:crear_propio`, `assignment:validar`, `assignment:corregir`, `dispatch_guide:crear`,
`dispatch_guide:verificar`, `inventory:ver`, `inventory:gestionar`, `company:*`, `product:gestionar`, `bank_account:gestionar`,
`vehicle_type:gestionar` (el uso exacto está en cada pantalla; búscalo con `grep -rn "hasPermission(" src`).
