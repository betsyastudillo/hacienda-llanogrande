# Transporte — Vehicle, Carrier, Assignment, DocumentBlacklist

## Cambio de enfoque tras el pivote de negocio

Con áridos, la hacienda (entonces "AridosCo") tenía flota propia y **asignaba** transporte, validando capacidad de carga contra tipos fijos (volqueta, patineta, mula). Con el pivote a venta agrícola, el transporte lo trae el cliente — el sistema ya no *asigna*, **valida y autoriza**. Por eso `Vehicle`/`Carrier` perdieron sus campos de vencimiento de documentos (`soat_expiration_date`, etc.) y de validación de capacidad: ya no es información que la hacienda deba gestionar activamente, solo verificar puntualmente al momento de cada envío (ver más abajo).

## `Vehicle` / `Carrier`

Sin validación automática de capacidad ni de vencimientos de documentos — esa revisión ahora es manual, hecha por `logistica` al momento de aprobar un `Assignment` (ver siguiente sección), no una regla que bloquee automáticamente en el modelo.

`Carrier` tiene `document_type` + `document_id` (antes solo un campo de documento sin tipo) — necesario para evitar homónimos y para cruzar contra `DocumentBlacklist` con precisión.

## `Assignment` — validación de transporte, no asignación

Flujo: el cliente **envía** los datos del vehículo/transportista (no elige de una lista existente — manda los datos completos, y el service busca-o-crea el registro en `Vehicle`/`Carrier` si no existían, `_find_or_create_vehicle` / `_find_or_create_carrier`). Queda en `validation_status: "pending"`.

`logistica` revisa manualmente (documentos, antecedentes) y decide:
- **Aprobar** — exige `background_check_verified: true` explícito (checkbox de "sí revisé antecedentes"). El `Order` pasa a `transport_validated`.
- **Rechazar** — exige `rejection_reason`. El pedido **no** avanza de estado. El cliente puede reenviar otro vehículo/transportista para el mismo pedido (`PUT /assignments/order/{id}/resubmit`) — solo si el estado actual es `rejected`, nunca sobre uno `pending` o `approved`.

Al rechazar, opcionalmente se puede **vetar** el documento del transportista en el mismo paso (`blacklist_carrier: true`) — crea una entrada en `DocumentBlacklist` y desactiva automáticamente cualquier `Carrier` existente con ese documento.

## `DocumentBlacklist`

Lista de documentos vetados (`document_type` + `document_number`, único). Se consulta en `_find_or_create_carrier` antes de reutilizar o crear un transportista — si está vetado, la operación falla ahí mismo, nunca llega a crear un `Assignment` pendiente.

El chequeo de antecedentes judiciales/policiales en sí es **manual** — no hay integración con ningún servicio externo. El portal público de la Policía Nacional (`antecedentes.policia.gov.co`) no expone una API pensada para automatizarse; `logistica` lo consulta por su cuenta y usa este módulo solo para registrar el resultado.
