# Empresas — Companies / CompanyNew

Archivos en `pages/Companies/` (listado) y `pages/Companies/CompanyNew/` (formulario de creación).

## `Companies.jsx` — listado

`GET /companies/?company_type=client` para listar solo clientes en este módulo (el filtro `company_type` es un query param opcional del backend, reutilizable para cualquier tipo). Badge de `verification_status` con `companyStatus.js` + `StatusBadge`.

## `CompanyNew.jsx` — crear empresa, en dos pasos dentro de la misma pantalla

No usa dos rutas distintas — es un único componente con un estado `step` (`1` o `2`), porque técnicamente **no se puede subir un documento a una empresa que todavía no existe** (`Document.company_id` es una FK real). El flujo:

1. **Paso 1** — formulario de datos (`POST /companies/`). Al tener éxito, se guarda el `id` devuelto en el estado local y se pasa a `step: 2`.
2. **Paso 2** — con el `company_id` ya conocido, se pueden subir documentos (`POST /documents/{company_id}/documents`, con `FormData` y `multipart/form-data`) sin salir de la pantalla ni cambiar de URL.

Subir documentos en el paso 2 es opcional — se puede completar después. No hay botón para "volver" al paso 1 una vez creada la empresa; para corregir esos datos existe el flujo de edición normal, aparte.

**Pendiente:** el formulario todavía no distingue persona natural vs. jurídica (lista de documentos distinta según el tipo) — quedó identificado pero no construido.
