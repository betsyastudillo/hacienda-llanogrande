# Guía de despacho — DispatchGuide

## Propósito: evitar "colados" en portería

El QR **no contiene los datos del despacho** — contiene una URL con un token largo y aleatorio (`secrets.token_urlsafe(32)`) que apunta al único endpoint público de verificación del sistema (`GET /dispatch-guides/verify/{token}`, sin `require_permission` ni `get_current_user`, porque quien escanea en portería no necesariamente tiene sesión iniciada). El token es de un solo uso: al verificarse, `status` pasa a `"used"` y un segundo intento con el mismo token falla.

Al verificar exitosamente, se muestran los datos del vehículo/transportista **autorizados** (los que quedaron en el `Assignment` aprobado de ese pedido), para que portería compare contra quien se presenta físicamente con tarjeta de propiedad/cédula.

## Generación

`POST /dispatch-guides/` — solo `logistica`/`admin`. `origin` se resuelve de la dirección de la `Company` con `type="own"` (nunca hardcodeado); `destination`, de la dirección del cliente del pedido.

### Bug pendiente conocido

`create_dispatch_guide` hoy solo exige `order.status == "payment_confirmed"` y que exista **algún** `Assignment` para el pedido — no valida `Assignment.validation_status == "approved"`. Esto significa que, tal como está el código, se podría generar una guía de despacho válida para un pedido cuyo transporte fue **rechazado** o sigue pendiente de revisión, siempre que exista la fila de `Assignment`. Corregirlo implica cambiar la condición a exigir `transport_validated` (el estado que el pedido alcanza solo cuando `logistica` aprueba) y/o revisar `validation_status` directamente.

## `BASE_URL`

La URL que se codifica dentro del QR se arma con `settings.base_url` (variable de entorno) — en desarrollo, debe apuntar a la IP de red local (no `localhost`) para que un teléfono en la misma red pueda resolver la URL al escanear. Ver notas de despliegue en el `README.md` de la raíz del repo.
