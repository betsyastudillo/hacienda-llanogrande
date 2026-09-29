# Frontend — Hacienda Llanogrande

Documentación técnica del frontend. Para instrucciones de instalación y variables de entorno, ver el `README.md` de la raíz del repositorio.

## Stack

- React (Vite)
- react-router-dom — enrutamiento
- axios — cliente HTTP
- react-bootstrap — algunos componentes de formulario
- lucide-react — íconos

## Estructura de carpetas

```
src/
  components/     Piezas reutilizables, sin lógica de negocio propia (ver components.md)
  constants/       Listas y mapas compartidos: estados, roles, unidades (ver constants.md)
  context/         Estado global de sesión (ver context.md)
  pages/            Pantallas, organizadas por dominio:
    Login/
    LinkLogin/              (pantalla de aterrizaje del magic link — ver pages/magic-link.md)
    Orders/
      OrderNew/
      OrderDetail/
    Products/
      ProductForm/
      Inventory/              (listado general de inventario)
        ProductInventory/     (detalle de inventario de un producto — anidado dentro de Inventory)
    Companies/
      CompanyNew/            (formulario de crear empresa, 2 pasos — ver pages/companies.md)
  services/         Cliente de API (api.js)
  utils/            Funciones puras reutilizables (ej. formatDate.js)
```

Nota: el listado de inventario y el detalle de inventario por producto viven anidados dentro de `pages/Products/`, no como módulo independiente — reflejando que, aunque el inventario tiene su propia ruta (`/inventory`) y su propio link en el sidebar, conceptualmente es una vista sobre los productos.

## Convenciones

- **Un archivo `.css` por componente/página**, mismo nombre, misma carpeta.
- **Colores como variables CSS**, definidas en `index.css` (`--bg`, `--red-soft`, `--red-wine`, `--text`, `--text-footer`, `--border`, `--white-bg`, `--error`, `--error-bg`, etc). Solo en casos demasiado específicos se dejaron colores sueltos en hexadecimal dentro de un componente, como el caso de ProductInventory, que maneja colores para los valores distintos a las variables por diseño.
- **Nombres de rutas en `App.jsx` siempre absolutos** (`/orders/new`, nunca `new`), porque el grupo de rutas protegidas no tiene un `path` propio — ver nota en `context.md`.
- **La visibilidad de botones/secciones según rol se decide con `hasPermission('recurso:accion')`**, nunca comparando `user.role` directamente contra un string. El backend es la única fuente de verdad de qué puede hacer cada rol; el frontend solo pregunta.
- **La URL del backend se resuelve sola**, en `services/api.js`, usando `window.location.hostname` — así el mismo build funciona en `localhost` y en la IP de red local (para pruebas desde el teléfono) sin tocar código.

## Patrón de pantallas con listado + formulario

La mayoría de módulos (Orders, Products, Companies) siguen el mismo patrón:
- Un listado (`Xxx.jsx`) con buscador y, si aplica, botón "Nuevo".
- Un formulario de creación (`XxxNew.jsx` o `XxxForm.jsx` si también sirve para editar).
- Cuando el formulario es corto y no necesita su propia URL, se usa el componente `Modal` en vez de una pantalla nueva (ver ejemplo en Inventario).
