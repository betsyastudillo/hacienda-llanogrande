# Constants

Cada archivo aquí es la única fuente de verdad para un tipo de dato que varias pantallas necesitan mostrar igual. Si algo se ve inconsistente entre dos pantallas (un color de estado distinto, una etiqueta con otro texto), el arreglo casi siempre es en uno de estos archivos, no en cada página por separado.

## `orderStatus.js`

- `ORDER_STATUS_STEPS` — lista ordenada de los 6 estados del pedido (`created` → `facturado`), usada por el stepper del detalle de pedido.
- `STATUS_LABELS` — texto en español de cada estado, derivado automáticamente de `ORDER_STATUS_STEPS`.
- `STATUS_COLORS` — fondo/texto por estado, para `StatusBadge`.
- `STATUS_ICONS` — ícono de `lucide-react` por estado.
- `STATUS_DESCRIPTIONS` — texto explicativo, usado en `StatusHelpPopover`.

## `companyStatus.js`

Mismo patrón que `orderStatus.js`, pero para `verification_status` de `Company` (`pending` / `approved` / `rejected`).

## `units.js`

`estimateWeightKg(approxWeightKg, unit, quantity)` — calcula el peso aproximado de una línea de pedido. Recibe el `approx_weight_kg` real del producto (no busca por nombre) y hace `quantity * approxWeightKg`, salvo cuando `unit` ya es `kg` o `tonelada`, donde el cálculo es directo. Devuelve `null` si el producto no tiene ese dato cargado — la pantalla debe mostrar "—" en ese caso, no un error.

## `inventoryReasons.js`

`ADJUSTMENT_CATEGORIES` — las tres categorías de ajuste de inventario (`damage`, `count_difference`, `other`). El motivo en sí sigue siendo texto libre; solo la categoría es un select controlado.

## `companyDocuments.js`

`COMPANY_DOCUMENT_TYPES` — tipos de documento esperados al subir archivos de una empresa (Cámara de Comercio, RUT, etc.). Es una lista sugerida para el frontend; el backend acepta `document_type` como texto libre, así que agregar un tipo nuevo aquí no requiere ningún cambio de backend.

## `menu.js`

`MENU_ITEMS` — los links del sidebar, cada uno con su `permission` requerido (`null` = visible para cualquier autenticado). Agregar una pantalla nueva al menú es agregar una línea aquí, nunca tocar `Sidebar.jsx` directamente.
