# Context — AuthContext

`src/context/AuthContext.jsx` es la única fuente de verdad sobre la sesión del usuario en el frontend.

## Qué guarda

- `token` — el JWT, persistido en `localStorage` bajo la clave `access_token`.
- `user` — el perfil completo del usuario autenticado, obtenido de `GET /users/me` (no se decodifica del JWT directamente). Incluye `role`, `company_id`, `full_name`, y **`permissions`**: la lista de permisos reales del rol, calculada por el backend a partir de `ROLES_PERMISSIONS`.
- `loading` — true mientras se resuelve la sesión al cargar la app (evita parpadeos de "no autenticado" antes de confirmar el token).

## Por qué se llama a `/users/me` en vez de decodificar el JWT

El JWT solo lleva `sub` (document_id), `role` y `company_id`. La lista de permisos no viaja en el token — se pide aparte para que, si el backend cambia qué puede hacer un rol, el usuario la reciba actualizada la próxima vez que cargue la app, sin tener que re-emitir tokens.

## `hasPermission(permission)`

```js
const hasPermission = (permission) => {
  if (!user) return false
  return user.permissions.includes('*') || user.permissions.includes(permission)
}
```

`'*'` es el comodín del rol `admin` (definido en el backend, `constants/permissions.py`) — si el rol lo tiene, pasa cualquier chequeo sin necesidad de listar cada permiso individual.

**Regla del proyecto:** ningún componente debe comparar `user.role === 'admin'` ni similares para decidir qué mostrar. Siempre se usa `hasPermission('recurso:accion')`. Esto mantiene una sola fuente de verdad (el backend) y evita que el frontend "invente" reglas de autorización que puedan desincronizarse de las reales.

## `ProtectedRoute`

`components/ProtectedRoute.jsx` redirige a `/login` si no hay `token`. Envuelve al `Layout` (header + sidebar) en `App.jsx`:

```jsx
<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
  <Route path="/orders" element={<Orders />} />
  ...
</Route>
```

Importante: esa ruta padre **no tiene `path` propio** — solo agrupa. Por eso cada ruta hija debe escribirse con su path absoluto completo (`/orders/new`, no `new`); de lo contrario React Router la cuelga de la raíz `/` en vez de anidarla bajo `/orders`.

## `login()` / `logout()`

- `login(accessToken)` — guarda el token en `localStorage` y dispara el `useEffect` que carga `/users/me`.
- `logout()` — limpia `localStorage` y el estado `user`/`token`. Los componentes que llaman `logout()` deben además hacer `navigate('/login')` manualmente; el contexto no redirige por sí solo.
