# Componentes reutilizables

Ninguno de estos componentes conoce reglas de negocio — reciben datos por props y los muestran. Si necesitas cambiar *qué* se muestra (colores, textos, condiciones de visibilidad), ese cambio va en la página que los usa o en `constants/`, no dentro del componente.

## `Modal`

`components/Modal/Modal.jsx` — overlay genérico con backdrop y botón de cerrar.

```jsx
<Modal title="Registrar movimiento" onClose={handleClose}>
  {/* contenido del formulario */}
</Modal>
```

Se usa cuando un formulario es corto y no amerita su propia URL/pantalla (ej. registrar un movimiento de inventario). El backdrop cierra el modal al hacer clic fuera; el `stopPropagation` dentro de la tarjeta evita que un clic en el contenido lo cierre por error.

## `SearchInput`

`components/SearchInput/SearchInput.jsx` — input de búsqueda con ícono, controlado (`value`/`onChange`). No sabe qué campos filtrar: cada pantalla decide su propia lógica de filtrado sobre los datos ya cargados en memoria (no dispara una llamada a la API por cada tecla).

## `StatusBadge`

`components/StatusBadge/StatusBadge.jsx` — badge de color genérico:

```jsx
<StatusBadge label="Aprobado" bgColor="#D9F0DC" textColor="#1F5C29" icon={CircleCheck} />
```

Usado para estados de pedido (`orderStatus.js`) y de empresa (`companyStatus.js`). Al agregar un nuevo "tipo de estado" en el sistema (ej. estado de validación de transporte), no se crea un badge nuevo — se define su mapa de labels/colores en `constants/` y se reutiliza este componente.

## `StatusHelpPopover`

Popover que explica el significado de cada estado del pedido, usado como header clickeable de la columna "Estado" en el listado de pedidos.

## `UnitReferenceHelper`

Panel de ayuda con equivalencias aproximadas de peso por presentación (canasta, bulto), usado en el formulario de crear pedido. Los valores son estimaciones fijas escritas a mano, no vienen de la base de datos — ver la sección de pesos en `pages/products.md`.

## `Header` y `Sidebar`

Viven en `components/Layout/`. `Layout.jsx` los envuelve junto con el `<Outlet />` de React Router. El `Sidebar` filtra sus links con `hasPermission()` contra `constants/menu.js` — nunca hay que tocar el componente en sí para agregar/quitar un link, solo ese archivo de constantes.

En mobile, el `Sidebar` se comporta como panel flotante (con backdrop oscuro) en vez de empujar el contenido; en escritorio, empuja el contenido lateral. El botón hamburguesa del `Header` alterna su visibilidad.

## `ProtectedRoute`

Ver `context.md`.
