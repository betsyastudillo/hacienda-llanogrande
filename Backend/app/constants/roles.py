# Roles para permisos
# Hacienda (empresa propia)
ADMIN = "admin" # Acceso completo a todo el sistema
LOGISTICA = "logistica" # Valida documentos de vehículo / conductos antes de autorizar el ingreso para recogida de pedido.
CARTERA = "cartera" # Gestiona pagos y facturación
OPERACIONES = "operaciones" # Administra el catálogo de productos, aprueba / rechaza documentos.
SOPORTE = "soporte" # Consulta de pedidos, asignaciones, pagos y guias.

# Roles individuales para clientes
CLIENTE_ADMIN = "cliente_admin" # Ve todos los pedidos de sue empresa
CLIENTE_OPERATIVO = "cliente_operativo" # Crea pedidos y solo ve los que él haya creado.

# Roles internos de la empresa
INTERNAL_ROLES = (ADMIN, LOGISTICA, CARTERA, OPERACIONES, SOPORTE)

# Roles del cliente
CLIENT_ROLES = (CLIENTE_ADMIN, CLIENTE_OPERATIVO)

ALL_ROLES = INTERNAL_ROLES + CLIENT_ROLES

# Crear una orden o pedido
CAN_CREATE_ORDER = (ADMIN, CLIENTE_ADMIN, CLIENTE_OPERATIVO)

# Validar transporte (vehiculo y transportador)
CAN_MANAGE_FLEET = (ADMIN, LOGISTICA)

# Ver el transporte (vehiculo y transportador)
CAN_VIEW_FLEET = (ADMIN, LOGISTICA, OPERACIONES)

# Modificar el catálogo
CAN_MANAGE_CATALOG = (ADMIN, OPERACIONES)

# Aprobar o rechazar las documentación
CAN_REVIEW_DOCUMENTS = (OPERACIONES, ADMIN)

# Ver los documentos
CAN_VIEW_DOCUMENTS = (ADMIN, OPERACIONES, CARTERA, SOPORTE)

# Modificar las empresas
CAN_MANAGE_COMPANIES = (ADMIN,)

# Ver las empresas
CAN_VIEW_COMPANIES = (ADMIN, CARTERA, SOPORTE)

# Ver todos los soported de pagos
CAN_VIEW_PAYMENTS_ALL = (ADMIN, CARTERA, SOPORTE)

# Ver todas las guías de despacho
CAN_VIEW_DISPATCH_GUIDES = (ADMIN, OPERACIONES, LOGISTICA, SOPORTE)

# Modificar usuarios
CAN_MANAGE_USERS = (ADMIN,)
