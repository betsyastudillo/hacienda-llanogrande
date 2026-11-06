# Hacienda Llanogrande — Sistema de pedidos y despacho

Sistema web para que **Hacienda Llanogrande** venda y despache productos cosechados a empresas clientes.
Cubre todo el ciclo: registrar y aprobar empresas clientes → crear pedidos → cobrar (proforma + comprobante) →
emitir factura → autorizar el transporte que recoge → generar guía de despacho con QR → controlar la entrada y
salida en portería → descontar el inventario.

> **Origen del proyecto.** Empezó como prueba técnica para una empresa de venta de áridos (arena, material de
> construcción) y se está convirtiendo en la base de un sistema real para productos agrícolas. Quedan rastros del
> dominio anterior en algunos nombres (por ejemplo `OrderItem.quantity_m3`, o el sector `construccion`).
> Están listados en [docs/06-pendientes-y-decisiones.md](docs/06-pendientes-y-decisiones.md).

## ¿Por dónde empiezo a leer? (guía rápida para quien recibe el proyecto)

Lee en este orden:

| # | Documento | Para qué sirve |
|---|-----------|----------------|
| 1 | [docs/00-conceptos-basicos.md](docs/00-conceptos-basicos.md) | Explica, desde cero, las tecnologías usadas (Python, FastAPI, SQLAlchemy, Alembic, React). Si ya las conoces, sáltalo. |
| 2 | [docs/01-vision-y-estado.md](docs/01-vision-y-estado.md) | Qué se quería lograr, qué está terminado, qué está a medias. |
| 3 | [docs/02-flujo-del-pedido.md](docs/02-flujo-del-pedido.md) | **El corazón del sistema**: diagramas y paso a paso del pedido, con la tabla, función y pantalla de cada paso. |
| 4 | [docs/03-arquitectura.md](docs/03-arquitectura.md) | Cómo está organizado el código y las reglas que se siguen (errores, permisos, auditoría, archivos). |
| 5 | [docs/04-modelo-de-datos.md](docs/04-modelo-de-datos.md) | Cada tabla, sus columnas y relaciones. |
| 6 | [docs/05-guia-de-pruebas.md](docs/05-guia-de-pruebas.md) | Cómo probar a mano cada módulo (Swagger, SQL, interfaz). |
| 7 | [docs/06-pendientes-y-decisiones.md](docs/06-pendientes-y-decisiones.md) | Errores conocidos, deuda técnica y decisiones tomadas. **Léelo antes de tocar código.** |
| 8 | [Backend/docs/](Backend/docs/README.md) | Referencia del backend: endpoints, servicios (cada función), permisos. |
| 9 | [Frontend/docs/](Frontend/docs/README.md) | Referencia del frontend: rutas, pantallas, componentes, contexto. |

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.9, **FastAPI**, SQLAlchemy 2, Pydantic v2, Alembic |
| Base de datos | PostgreSQL alojado en [Neon](https://neon.tech) |
| Frontend | React 19 + Vite, react-router-dom, axios, react-bootstrap, lucide-react, html5-qrcode |
| Autenticación | JWT (login con **número de documento**, no con email) y *magic link* para clientes |
| PDF / QR | reportlab (proforma y factura), qrcode (guía de despacho) |

## Estructura del repositorio

```
AridosCo/
├── README.md                  ← este archivo
├── CLAUDE.md                  ← reglas de trabajo para el asistente de IA (y buena lectura para humanos)
├── docs/                      ← documentación general (esta guía)
├── Backend/
│   ├── app/
│   │   ├── main.py            ← crea la app FastAPI, CORS y registra los routers
│   │   ├── config.py          ← lee las variables de entorno (.env)
│   │   ├── database.py        ← conexión a la base de datos y sesión por petición
│   │   ├── dependencies.py    ← usuario actual y chequeo de permisos
│   │   ├── auth_dependencies.py ← atajos tipados de permisos para los endpoints
│   │   ├── constants/         ← reglas de negocio fijas (permisos, roles, requisitos)
│   │   ├── models/            ← tablas (SQLAlchemy)
│   │   ├── schemas/           ← forma de lo que entra/sale de la API (Pydantic)
│   │   ├── services/          ← LÓGICA DE NEGOCIO
│   │   └── routers/           ← endpoints HTTP
│   ├── alembic/versions/      ← migraciones de la base de datos
│   ├── uploads/               ← archivos subidos/generados (NO está en git)
│   ├── scripts/build_colombia.py ← genera la lista de departamentos/municipios
│   └── docs/                  ← referencia técnica del backend
└── Frontend/
    ├── src/
    │   ├── App.jsx            ← rutas
    │   ├── pages/             ← una carpeta por pantalla
    │   ├── components/        ← piezas reutilizables
    │   ├── context/           ← sesión (AuthContext) y avisos (ToastContext)
    │   ├── services/api.js    ← cliente HTTP (axios)
    │   ├── constants/         ← estados, colores, menú, listas
    │   └── utils/             ← formato de fechas/dinero, validadores
    └── docs/                  ← referencia técnica del frontend
```

## Poner a funcionar el proyecto desde cero

### Requisitos
- **Python 3.9** (importante: no usar sintaxis de Python 3.10+, por ejemplo `X | None`; se usa `Optional[X]`).
- **Node.js** y npm.
- Una base PostgreSQL (en Neon: crea un proyecto y copia la cadena de conexión).

### 1. Backend

```bash
cd Backend
python3 -m venv venv              # crea el entorno virtual (solo la primera vez)
source venv/bin/activate          # actívalo (cada vez que abras una terminal nueva)
pip install -r requirements.txt   # instala las librerías
```

Crea el archivo `Backend/.env` (NO se sube a git; contiene secretos). Variables que lee
[Backend/app/config.py](Backend/app/config.py):

| Variable | ¿Obligatoria? | Para qué sirve |
|----------|---------------|----------------|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL (la entrega Neon) |
| `JWT_SECRET_KEY` | Sí | Clave con la que se firman los tokens de sesión. Larga y aleatoria. |
| `PAYMENT_WEBHOOK_SECRET` | Sí (aunque hoy no se usa) | Quedó de un diseño anterior de pagos por webhook; hoy el código no la usa, pero `Settings` la exige, así que hay que ponerle cualquier valor. |
| `JWT_ALGORITHM` | No (`HS256`) | Algoritmo de firma |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No (`30`) | Duración de la sesión |
| `FRONTEND_URL` | No (`http://localhost:5173`) | **Es la URL que se codifica dentro del QR de la guía de despacho.** Si se prueba desde el celular, debe ser `http://IP-DEL-COMPUTADOR:5173`. |
| `BASE_URL` | No (`http://localhost:8000`) | Definida en la configuración pero hoy ningún código la usa. |

Aplica las migraciones y levanta el servidor:

```bash
alembic upgrade head              # crea/actualiza las tablas en la base de datos
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- La documentación interactiva (Swagger) queda en <http://localhost:8000/docs>.
- `--host 0.0.0.0` permite abrir el sistema desde otro dispositivo de la misma red (el celular, por ejemplo).
- La carpeta `Backend/uploads/` debe existir (el servidor la monta como estática; si no existe, el arranque falla).

### 2. Primer usuario administrador

Un usuario necesita una empresa (`users.company_id` es obligatorio), y para crear pedidos y guías debe existir la
**empresa propia** (`company_type = 'own'`, la Hacienda). `POST /auth/register` exige estar autenticado como admin, por lo
tanto **el primer admin y la primera empresa se crean directamente en la base de datos**.

> ⚠️ El README anterior mencionaba un script `seed_admin.py`; **ese archivo no existe en el repositorio**.
> En [docs/05-guia-de-pruebas.md](docs/05-guia-de-pruebas.md#0-datos-iniciales-primer-admin-y-empresa-propia) está el
> procedimiento paso a paso.

### 3. Frontend

```bash
cd Frontend
npm install
npm run dev                       # http://localhost:5173
```

El frontend decide a qué backend llamar así: `http://<el mismo host con el que abriste la página>:8000`
([Frontend/src/services/api.js](Frontend/src/services/api.js)). Es decir, si abres `http://192.168.1.20:5173`, llamará a
`http://192.168.1.20:8000`. (La variable `VITE_API_BASE_URL` del `Frontend/.env` hoy **no se usa**.)

CORS en el backend solo acepta orígenes `http://localhost:5173` y `http://192.168.x.x:5173`
([Backend/app/main.py](Backend/app/main.py)). Para otro dominio/puerto hay que cambiar esa expresión.

## Roles del sistema

| Rol | Quién es | Qué hace |
|-----|----------|----------|
| `admin` | Hacienda | Todo (`"*"`). Aprueba empresas. |
| `cartera` | Hacienda | Confirma o rechaza pagos; administra cuentas bancarias; ve facturas. |
| `logistica` | Hacienda | Valida el transporte (vehículo, transportador, documentos), genera guías, anula/corrige retiros, administra lista negra. |
| `operaciones` | Hacienda | Catálogo de productos, inventario, empresas y revisión de sus documentos. |
| `soporte` | Hacienda | Consulta amplia de pedidos, pagos, retiros, guías, empresas. Edición limitada. |
| `porteria` | Hacienda | Solo escanea la guía en la puerta: registra ingreso y salida. |
| `cliente_admin` | Cliente | Crea pedidos, ve todos los de su empresa, paga, programa retiros. |
| `cliente_operativo` | Cliente | Igual, pero solo ve los pedidos que él mismo creó. |

Detalle completo de permisos: [Backend/docs/permissions.md](Backend/docs/permissions.md).

## Mantenimiento de esta documentación

Cuando un cambio modifique el flujo, una regla de negocio, una variable de entorno o un endpoint, actualiza el
documento correspondiente **en el mismo commit**. La sección "Estado actual" en
[docs/01-vision-y-estado.md](docs/01-vision-y-estado.md) es la que más rápido se desactualiza.

## Documentación y docstrings

- Cada función de `Backend/app/services/`, `Backend/app/constants/`, `dependencies.py` y `database.py` tiene un
  *docstring* en español (texto entre `"""` justo debajo del `def`) que explica qué hace y sus reglas.
  En VS Code se ve al pasar el cursor sobre el nombre de la función.
- Los routers no llevan docstring: su descripción es el `summary="…"` del decorador (se ve en Swagger, `/docs`).
- Los docstrings se agregaron sin cambiar la lógica (solo líneas añadidas; los archivos compilan).

