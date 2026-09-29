# Autenticación y usuarios — User, MagicLink

## `User` / JWT

Login por `document_id`, no email. Contraseñas con `bcrypt` nativo (no `passlib`, por incompatibilidad de versiones detectada durante el desarrollo). El JWT lleva `sub` (document_id), `role` y `company_id` — no lleva la lista de permisos; el frontend la pide aparte vía `GET /users/me` (ver `docs/frontend/context.md`), para que un cambio en `ROLES_PERMISSIONS` se refleje sin necesidad de reemitir tokens existentes.

`POST /auth/register` requiere ser `admin` (permiso `user:gestionar`, que nadie más tiene). Esto crea un problema de arranque real: no puede existir un primer admin sin que otro admin ya exista. Se resolvió una vez con un script de un solo uso (`seed_admin.py`, inserta directo en la base usando la función `hash_password` del propio proyecto) — no forma parte del flujo normal de la aplicación, es una herramienta de bootstrap.

Cada usuario puede editar su propio perfil (`PUT /users/me`) y contraseña (`PATCH /users/me/password`, exige la contraseña actual) sin necesitar ningún permiso especial — la autorización ahí es "eres dueño de esta cuenta", no un rol.

## `MagicLink`

Login sin contraseña, de un solo uso, para un usuario cliente ya existente. Solo `admin` puede generarlo (mismo permiso `user:gestionar`), eligiendo explícitamente empresa **y** usuario específico dentro de ella (una empresa puede tener varios `cliente_admin`/`cliente_operativo`).

`POST /magic-links/` crea el token (expira en 48h por defecto, `MAGIC_LINK_EXPIRATION_HOURS`). `GET /magic-links/verify/{token}` es público — valida que no esté usado ni vencido, lo marca como `used`, y devuelve un `access_token` real, idéntico en forma al de un login normal (mismo `create_access_token`). El frontend (`LinkLogin.jsx`) simplemente guarda ese token como si el usuario hubiera iniciado sesión por el formulario normal.

Solo puede generarse para roles `cliente_admin`/`cliente_operativo` — no existe (ni tendría sentido) un magic link para roles internos de la hacienda.
