# Pagos — Payment, BankAccount

## Cambio de enfoque respecto al diseño original

La primera versión simulaba una pasarela bancaria con un webhook protegido por secreto compartido (`X-Webhook-Secret`). El negocio real no tiene pasarela: el cliente transfiere manualmente a una cuenta de la hacienda, y alguien de `cartera` confirma el pago a mano después de revisar el extracto. El webhook se eliminó por completo — `Payment` se reformó, no se descartó.

## `BankAccount`

Cuentas bancarias de la hacienda (`company_id` siempre apunta a la empresa `type="own"`, validado en el service). Incluye datos del titular (`account_holder_name`, `account_holder_document_type/number`) y `agreement_number` opcional (convenio de recaudo, común en cuentas empresariales colombianas).

`company_id` en este modelo se mantuvo como relación explícita, no un valor implícito fijo, para no cerrar la puerta a que la hacienda tenga más de una empresa propia (multi-sede) en el futuro — el costo de dejarlo ahora es casi nulo; agregarlo después sería una migración real con backfill.

## `Payment`

Reemplaza el flujo de webhook por una **proforma**: `proforma_number` (autogenerado, formato `PRO-2026-0001`, consecutivo por año) reemplaza al antiguo `bank_reference`. `bank_account_id` guarda qué cuenta eligió el cliente para ese pedido específico — el cliente elige de la lista de cuentas activas al crear el pago.

- `POST /payments/` — crea la proforma. Exige que el `Order` esté en estado `created` (el pago se pide antes de solicitar transporte, no después — orden invertido respecto al negocio original de áridos).
- `POST /payments/{id}/confirm` — reemplaza al webhook. Solo `cartera`/`admin`. Body `{"status": "confirmed" | "failed"}`. Al confirmar, `confirmed_at` se estampa (columna propia, no `updated_at` del mixin) y `Order.status` pasa a `payment_confirmed`.

`pdf_url` existe en el modelo pero la generación del PDF de la proforma **no está construida** — es uno de los pendientes conocidos.
