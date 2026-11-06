# Frontend — Hacienda Llanogrande

Documentación técnica del frontend. Para instalar y arrancar, ver el [README raíz](../../README.md).
Para entender el negocio, empieza por [docs/02-flujo-del-pedido.md](../../docs/02-flujo-del-pedido.md).

## Índice de esta carpeta

| Archivo | Contenido |
|---|---|
| [pantallas-y-rutas.md](pantallas-y-rutas.md) | Todas las rutas, qué pantalla es cada una, qué endpoints usa y cómo funciona la sesión |
| [detalle-del-pedido.md](detalle-del-pedido.md) | `OrderDetail` y sus tarjetas (`PaymentCard`, `InvoiceCard`, `TransportCard`), portería (`ScanGuide`, `VerifyGuide`), `OrderNew`, `Orders` |
| [components.md](components.md) | Componentes reutilizables (`Modal`, `StatusBadge`, …) |
| [constants.md](constants.md) | Listas y mapas de estados/colores |
| [context.md](context.md) | `AuthContext` y `ProtectedRoute` |
| [pages/](pages/) | Notas por módulo: companies, inventory, login, magic-link, orders, products |

## Stack

- React 19 + Vite 8 (`npm run dev`, `npm run build`, `npm run lint`)
- react-router-dom 7 — enrutamiento
- axios — cliente HTTP (`src/services/api.js`)
- react-bootstrap + bootstrap — algunos componentes de formulario
- lucide-react — íconos
- html5-qrcode — lectura del QR con la cámara (portería)
- jwt-decode — lectura del vencimiento del token

## Estructura de carpetas (real)

```
src/
  main.jsx · App.jsx        Arranque y rutas
  components/               Piezas reutilizables (ver components.md)
    Layout/ Header/ Sidebar/ SessionGuard/ ScrollToTop/        Armazón de la app
    Modal/ ConfirmModal/ FilePreviewModal/ CollapsibleCard/    Diálogos y contenedores
    StatusBadge/ StatusIconBadge/ StatusHelpPopover/           Estados
    SearchInput/ ComplianceTable/ UnitReferenceHelper/         Formularios y tablas de ayuda
    ProtectedRoute.jsx · HomeRedirect.jsx                      Control de rutas
  constants/                Mapas de estados, colores, menú, listas (colombia.js lo genera Backend/scripts/build_colombia.py)
  context/                  AuthContext (sesión/permisos) y Toast/ToastContext (avisos)
  hooks/useVehicleTypes.js  Tipos de vehículo activos con etiqueta
  pages/                    Una carpeta por módulo (ver pantallas-y-rutas.md)
    Login/ LinkLogin/ Orders/ Products/ Companies/ Inventory/ BankAccounts/ VehicleTypes/ DispatchGuides/
  services/api.js           axios + token + manejo de sesión vencida
  utils/                    Funciones puras: formatCurrency, formatDate, formatQuantity, validators, getErrorMessage, jwt, …
```

> ℹ️ Una versión anterior de este archivo decía que `Inventory/` vivía dentro de `pages/Products/`. **Es independiente**:
> `pages/Inventory/` y `pages/Inventory/ProductInventory/`.

## Convenciones

- **Un `.css` por componente/página**, mismo nombre y carpeta.
- **Colores como variables CSS** en `index.css` (`--surface-page`, `--action`, `--text`, `--border`, `--error-text`, …). Hay pocas excepciones en hexadecimal (p. ej. `ProductInventory`, `constants/*Status.js`).
- **Rutas absolutas en `App.jsx`** (`/orders/new`). (Excepción actual: `banks-accounts` sin "/" inicial.)
- **Permisos con `hasPermission('recurso:accion')`**, nunca comparando `user.role`. El backend es la fuente de verdad; esto es solo cosmético.
- **Avisos:** `const { showToast } = useToast()` → `showToast(mensaje, 'success' | 'error', duracionMs)`. Todo resultado de una acción y todo error de un botón va como toast; los errores de validación de campo pueden ir junto al formulario.
- **Modales:** `Modal` con render condicional (`{open && <Modal …/>}`); `ConfirmModal` se monta solo cuando se necesita.
- **Vista previa de archivos:** `FilePreviewModal` con `fileUrl` (público) o `apiPath` (exige sesión; es lo que se usa para archivos sensibles).
- **Estados con badge:** `StatusBadge` + un mapa en `constants/*Status.js`.
- **Tarjetas del detalle de pedido:** `PaymentCard` e `InvoiceCard` son la plantilla (reciben `order`, el dato y `onChanged`); reutiliza las clases `pay-*` y `detail-*` de `OrderDetail.css`.
- **No usar `crypto.randomUUID()`:** la app se abre por IP desde el celular (contexto no seguro, no existe). Usa un contador o `Date.now()`.
- **La URL del backend** se arma en `services/api.js` con `window.location.hostname` + `:8000`. `VITE_API_BASE_URL` (en `.env`) hoy **no se usa**.
- **Mensajes de error del backend:** `getErrorMessage(err, 'texto por defecto')` extrae el `detail`.

## Patrón de pantalla con listado + formulario

Orders, Products y Companies siguen el mismo patrón:
- Listado (`Xxx.jsx`) con buscador y botón "Nuevo" según permiso.
- Formulario de creación (`XxxNew.jsx`, o `XxxForm.jsx` si también edita).
- Si el formulario es corto y no necesita URL propia, se usa `Modal` (ver Inventario, BankAccounts, VehicleTypes).

## Cómo agregar una pantalla (receta)

1. Crea `src/pages/MiModulo/MiModulo.jsx` y su `.css`.
2. Agrega la ruta **absoluta** en `App.jsx` dentro del grupo protegido.
3. Agrega la entrada en `constants/menu.js` con el `permission` que corresponda.
4. Carga datos con `api.get(...)` en un `useEffect`; maneja `loading` y `error`.
5. Oculta botones con `hasPermission(...)`; los resultados con `showToast(...)`.
6. Valida con `utils/validators.js` (las mismas reglas que el backend: teléfono 7–15 dígitos, dirección ≥ 8 caracteres…).
7. Documenta la pantalla en [pantallas-y-rutas.md](pantallas-y-rutas.md).
