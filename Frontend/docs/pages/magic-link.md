# Magic Link — LinkLogin

`pages/LinkLogin/LinkLogin.jsx` — ruta pública (`/magic-login?token=...`, fuera del bloque de `ProtectedRoute` en `App.jsx`). El archivo/carpeta se llama `LinkLogin`, no `MagicLogin`.

## Qué resuelve

Permite que `admin` genere un enlace de un solo uso para un usuario cliente ya existente (`cliente_admin`/`cliente_operativo`), de forma que esa persona entre directo a crear un pedido sin escribir usuario/contraseña. No es acceso anónimo: el link siempre queda ligado a una cuenta real y verificada, elegida por admin (empresa + usuario específico dentro de ella).

## Flujo

1. Al montar, lee el `token` de la URL y llama a `GET /magic-links/verify/{token}` — sin ningún header de autorización, porque quien abre el link no tiene sesión todavía.
2. Si el token es válido (no usado, no vencido), el backend responde con un `access_token` real — igual que un login normal — y se marca el link como usado en ese mismo momento (no se puede reutilizar).
3. El frontend llama `login(access_token)` del `AuthContext` y navega directo a `/orders/new`.
4. Si el token es inválido, ya usado o expiró, se muestra el mensaje de error que devuelve el backend, sin redirigir a ningún lado.

## Pendiente

La pantalla para que `admin` **genere** el link (elegir empresa → elegir usuario → generar y copiar la URL) todavía NO está construida en el frontend — hoy se genera manualmente desde Swagger (`POST /magic-links/`, requiere `user_id`).
