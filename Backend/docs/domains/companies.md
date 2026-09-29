# Empresas y documentos — Company, Document

## `Company`

`type`: `"own"` (la hacienda misma, se asume una sola fila) o `"client"`. `client_code` es un identificador legible generado por el service (`HAC-0001` para `own`, `CLI-0001` para `client`, consecutivo independiente por tipo) — existe **solo** para que un humano lo memorice o lo dicte por teléfono; nunca se usa como foreign key en ninguna otra tabla, el `id` (UUID) sigue siendo la llave real en todas las relaciones.

`display_name` es opcional — si existe, se usa en la interfaz en vez de `legal_name` (que suele ser el nombre completo registrado en Cámara de Comercio, largo). `OrderResponse.company_display_name` (un `computed_field` de Pydantic) resuelve esto automáticamente: `display_name` si existe, si no `legal_name`.

Solo `admin` puede crear/editar empresas (`company:gestionar`, nadie más lo tiene en `ROLES_PERMISSIONS`) — Empresa B (clientes) no tiene ningún acceso directo a su propio registro de `Company`, ni de lectura ni de edición.

## `Document`

Modelo genérico: pertenece a exactamente uno de `company_id` / `vehicle_id` / `carrier_id` (validado — nunca cero ni más de uno). `document_type` es texto libre en el backend; el frontend sugiere una lista por contexto (ver `docs/frontend/constants.md`), pero el backend no la valida contra una lista fija.

Flujo de aprobación: `status` empieza en `pending`; `operaciones`/`admin` lo cambian a `approved`/`rejected` (`PATCH /documents/documents/{id}/status`). Reemplazar el archivo (`PUT /documents/documents/{id}`) resetea `status` a `pending` automáticamente — un documento reemplazado siempre vuelve a pedir revisión, nunca hereda la aprobación del archivo anterior.

Nota de nomenclatura de rutas: el prefijo del router es `/documents`, y estos dos endpoints no llevan `company_id`/`vehicle_id`/`carrier_id` en el path (a diferencia de crear/listar) porque trabajan directo por `document_id`, sin importar de qué tipo de dueño es — de ahí el `/documents/documents/{id}` que se ve repetido pero es intencional.
