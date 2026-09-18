Readme · MD
# Hacienda Llanogrande — Sistema de pedidos y despacho
 
Sistema para gestionar el ciclo completo de venta y despacho de productos cosechados entre Hacienda Llanogrande y sus clientes (empresas compradoras).
 
**Nota:** este proyecto se construyó originalmente como prueba técnica para una empresa de venta de áridos (arena/material de construcción).
Actualmente está en proceso de pivote hacia el dominio de Hacienda Llanogrande (venta de productos cosechados). Algunas partes del código y de este documento
todavía reflejan el dominio anterior — ver la sección **Estado actual / En transición** más abajo.
 
## Stack
 
- **Backend:** FastAPI (Python 3.9), arquitectura en capas (`models/ schemas/ services/ routers/`)
- **Base de datos:** PostgreSQL en Neon, migraciones con Alembic
- **Frontend:** React (Vite) + react-bootstrap + react-router-dom + axios
- **Autenticación:** JWT (login por `document_id`, no email)
## Estructura del repositorio
 
```
Backend/
  app/
    models/       # Modelos SQLAlchemy
    schemas/       # Schemas Pydantic (validación de entrada/salida)
    services/      # Lógica de negocio
    routers/       # Endpoints FastAPI
  alembic/         # Migraciones de base de datos
  uploads/         # Archivos subidos (documentos, QR) — NO versionado en git
  requirements.txt
Frontend/
  src/
    pages/         # Pantallas
    components/    # Componentes reutilizables (Header, Sidebar, Layout, etc.)
    context/        # Manejo de sesión (AuthContext)
    services/       # Cliente de API (axios)
```
 
## Requisitos previos
 
- Python 3.9
- Node.js + npm
- Una base de datos PostgreSQL (el proyecto usa [Neon](https://neon.tech))
## Variables de entorno (Backend)
 
Crear un archivo `.env` dentro de `Backend/` con:
 
```
DATABASE_URL=postgresql://usuario:contraseña@host/basededatos
JWT_SECRET_KEY=una-clave-larga-y-aleatoria
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
PAYMENT_WEBHOOK_SECRET=otro-secreto-aleatorio
BASE_URL=http://localhost:8000
```
 
`BASE_URL` se usa para construir la URL que se codifica dentro del QR de las guías de despacho — debe apuntar a una dirección accesible por quien vaya a escanear el QR (en desarrollo local con red, usar la IP de la máquina en vez de `localhost`; ver notas de despliegue más abajo).
 
## Levantar el backend
 
```bash
cd Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
 
Swagger disponible en `http://localhost:8000/docs`.
 
### Crear el primer usuario admin
 
`POST /auth/register` requiere estar autenticado como `admin` — para crear el primer administrador, usar el script de un solo uso:
 
```bash
python seed_admin.py
```
 
(Editar el archivo primero con el `document_id`, `full_name` y `password` deseados. Requiere que ya exista una `Company` con `type="own"`.)
 
## Levantar el frontend
 
```bash
cd Frontend
npm install
npm run dev
```
 
Disponible en `http://localhost:5173`. El backend debe estar corriendo con CORS habilitado para ese origen (ya configurado en `app/main.py`).
 
## Flujo de negocio (estados del pedido)
 
```
created → transport_assigned → payment_confirmed → dispatch_guide_generated → dispatched → facturado (pendiente)
```
 
- **created** — el cliente crea el pedido con uno o varios productos.
- **transport_assigned** — validación del vehículo/transportista que retira el pedido (ver nota de transición: antes se *asignaba* transporte propio,
  ahora se *valida y autoriza* transporte de terceros).
- **payment_confirmed** — vía webhook simulado (`POST /payments/webhook`, protegido con secreto compartido, no con JWT de usuario). Con el cambio,
- este ya cambiaría su forma ya que no se va a hacer pagos sino por Banco, por ahora por instrucción.
- **dispatch_guide_generated** — se genera la guía de despacho con QR de un solo uso (token firmado, no contiene los datos directamente).
- Ahora "factura pro form". 
- **dispatched** — el QR se verifica en portería antes de dejar salir la mercancía; el token se invalida tras el primer uso.
- Pendiente confirmar si se sigue con la validación por QR.
- **facturado** — pendiente de implementar.
## Roles y permisos
 
Autorización mediante `require_role()` (`app/dependencies.py`), aplicada en todos los routers.
 
| Rol | Empresa | Responsabilidad |
|---|---|---|
| `admin` | Hacienda | Acceso completo |
| `logistica` | Hacienda | Validación de documentos de vehículo/transportista |
| `cartera` | Hacienda | Pagos, facturación |
| `operaciones` | Hacienda | Catálogo de productos, aprobación de documentos |
| `soporte` | Hacienda | Consulta amplia, edición limitada de pedidos |
| `cliente_admin` | Cliente | Ve todos los pedidos de su empresa |
| `cliente_operativo` | Cliente | Crea pedidos, ve solo los propios |
 
## Decisiones de diseño relevantes
Sujetos a modificaciones por cambio de orientación.
- **Snapshot de precios:** `Order.subtotal/tax/total` y `OrderItem.unit_price/subtotal` se guardan al momento de la venta, no se recalculan dinámicamente — es
  intencional, para que cambios futuros de precio no alteren pedidos históricos.
- **Sin mass assignment en campos sensibles:** `role`, `company_id`, `verification_status`, `is_active`, `created_by_user_id` nunca se asignan por
  `**data.dict()` — siempre campo por campo, explícito, en el servicio.
- **Soft delete:** todas las entidades usan `is_active` (boolean), no borrado real.
- **Guía de despacho vs. manifiesto de carga oficial (RNDC):** solo se construyó la guía de despacho interna. El manifiesto de carga electrónico
  regulado por el Ministerio de Transporte queda fuera de alcance (requiere habilitación como transportadora e integración externa real).
- **Factura no oficial:** se construirá con estructura de factura pero sin timbrado DIAN.
- **Python 3.9:** usar `Optional[X]`, no `X | None`.
- **Convención de nombres:** clases/archivos en singular e inglés, tablas en plural, excepto `nit`.
- **Alembic:** renombrar columnas/tablas requiere `alter_column`/`rename_table` a mano — el autogenerate no detecta renombres.
## Estado actual / En transición
 
El proyecto está migrando de dominio (venta de áridos → venta de productos cosechados). Cambios en curso:
 
- [ ] Renombrar `Material` → `Producto` (y ajustar unidades de medida)
- [ ] Rediseñar `Assignment`: de "asignar transporte propio por capacidad" a "validar y autorizar transporte de terceros por documentos vigentes"
- [ ] Agregar `client_code` (código legible tipo `CLI-0001`) a `Company`, independiente del `id` (UUID) interno
- [ ] Agregar auditoría de usuario (`created_by_user_id`, `updated_by_user_id`, `deleted_by_user_id`) a todas las entidades, vía mixin reutilizable
- [ ] Tabla `audit_log` para historial completo de cambios (snapshot JSON antes/después de cada operación)
- [ ] Mover capacidades de vehículo y tarifas de transporte de valores hardcodeados a configuración
- [ ] Migrar `User.role` de texto libre a un conjunto de valores validado (Enum o tabla `roles`)
- [ ] Invoice — pendiente de definir con el negocio (momento de generación, formato de numeración, recálculo de impuestos)
- [ ] Frontend: formulario de crear pedido, detalle de pedido con estado + QR
## Mantenimiento de este documento
 
Este README se actualiza en el mismo commit que introduce el cambio que documenta (nueva variable de entorno, nuevo paso de instalación, nueva decisión de 
diseño relevante) — no como tarea separada al final.
 




