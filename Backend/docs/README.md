# Backend — Hacienda Llanogrande

Documentación técnica del backend. Para instalar y arrancar, ver el [README raíz](../../README.md).
Para entender el negocio, empieza por [docs/02-flujo-del-pedido.md](../../docs/02-flujo-del-pedido.md).

## Índice de esta carpeta

| Archivo | Contenido |
|---|---|
| [endpoints.md](endpoints.md) | Todos los endpoints: ruta, permiso, qué hace y qué servicio llama |
| [servicios.md](servicios.md) | **Cada función de servicio**: qué hace, reglas y errores |
| [permissions.md](permissions.md) | Roles, matriz de permisos y cómo agregar uno |
| [../../docs/04-modelo-de-datos.md](../../docs/04-modelo-de-datos.md) | Tablas y relaciones |
| [../../docs/06-pendientes-y-decisiones.md](../../docs/06-pendientes-y-decisiones.md) | Errores conocidos y deuda técnica |

## Stack
FastAPI · Python 3.9 · SQLAlchemy 2 · Pydantic v2 · Alembic · PostgreSQL (Neon) · reportlab · qrcode · bcrypt · python-jose.

## Mapa de archivos

```
app/
  main.py                FastAPI(), CORS, monta /uploads, registra 19 routers, GET / (salud)
  config.py              Settings(BaseSettings): lee .env (database_url, jwt_secret_key, payment_webhook_secret, …)
  database.py            engine, SessionLocal, Base y get_db() (sesión por petición)
  dependencies.py        get_current_user, require_permission, require_any_permission, user_has_permission, require_role (legado)
  auth_dependencies.py   Tipos Annotated por permiso (OrderCreator, PaymentConfirmer, …)
  constants/
    permissions.py       ROLES_PERMISSIONS (fuente de verdad) + get_permissions_for_role
    roles.py             LEGADO: nombres de roles y tuplas CAN_*; sin uso real
    company_requirements.py  documentos y consultas por tipo de persona/sector, campos editables
    transport_requirements.py documentos/consultas de transporte, vencimientos, normalize_plate, is_owner_carrier, compute_missing_documents
    units.py             VALID_UNITS = kg, tonelada, unidad, m3, canasta, bulto
  models/                21 tablas + mixins.py (AuditMixin)
  schemas/               Entrada/salida (Pydantic) + mixins.py (AuditResponseMixin)
  services/              Lógica de negocio (ver servicios.md)
  routers/               19 routers (ver endpoints.md)
  utils/formatting.py    format_nit, format_document, format_account_number (los usa proforma_pdf)
alembic/versions/        58 migraciones; head = caffaa585f24
assets/logo.png          Logo para los PDF
scripts/build_colombia.py Genera la lista de departamentos y municipios para el frontend
uploads/                 Archivos subidos/generados (ignorado por git)
```

## Reglas de código (resumen; detalle en [docs/03-arquitectura.md](../../docs/03-arquitectura.md))

- Python 3.9: `Optional[X]`, nunca `X | None`.
- Servicios lanzan `ValueError`; routers la atrapan → `db.rollback()` → `HTTPException(400)`.
- Ajeno → 404, no 403.
- Permisos por `ROLES_PERMISSIONS` + tipos de `auth_dependencies.py`.
- Nunca asignación masiva (`Model(**data.dict())`) en campos sensibles (`role`, `company_id`, `verification_status`, `is_active`…): campo por campo.
- Nunca borrar movimientos de inventario; corregir con otro movimiento.
- Migraciones: nunca autogenerate para renombrar; nunca editar una aplicada; guardar antes de `upgrade`; `alembic check` después.
- Nombres: clases y archivos en singular e inglés (`Product`, `product.py`), tablas en plural.
- Orden de parámetros en endpoints: los `Annotated` sin valor por defecto antes de `db: Session = Depends(get_db)`.
- Comentarios y mensajes de error visibles al usuario en español.

## Cómo agregar una funcionalidad (receta)

Ejemplo: "guardar una nota en el pedido".
1. **Modelo**: agrega `note = Column(String, nullable=True)` en [models/order.py](../app/models/order.py).
2. **Migración**: `alembic revision --autogenerate -m "order note"` → **revisa** el archivo generado (debe ser solo `add_column`), guárdalo, `alembic upgrade head`, `alembic check`.
3. **Schema**: añade `note` a `OrderResponse` (y a `OrderCreate` si se recibe).
4. **Servicio**: asigna el campo explícitamente en `create_order`/`edit_order`; valida con `ValueError`.
5. **Router**: normalmente no cambia; si es un endpoint nuevo, usa un tipo de permiso y `try/except ValueError`.
6. **Frontend**: muestra/edita el campo y usa `showToast` para el resultado.
7. **Prueba** con Swagger + SQL y **actualiza la documentación**.

## Comandos útiles (desde `Backend/` con el venv activo)

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # servidor de desarrollo
alembic current            # versión de la base
alembic heads              # última versión del código
alembic upgrade head       # aplicar migraciones
alembic downgrade -1       # deshacer la última (¡cuidado con los datos!)
alembic check              # modelos y base deben coincidir
alembic stamp <revision>   # solo para reparar: marca versión sin ejecutar
```
