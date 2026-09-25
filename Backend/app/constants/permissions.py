ROLES_PERMISSIONS = {
    "admin": {"*"},

    "cartera": {
        "payment:crear", "payment:confirmar", "payment:ver",
        "bank_account:gestionar", "bank_account:ver",
        "company:ver",
        "order:ver_todos",
    },
    "logistica": {
        "vehicle:gestionar", "vehicle:ver",
        "carrier:gestionar", "carrier:ver",
        "assignment:validar", "assignment:ver",
        "dispatch_guide:crear", "dispatch_guide:ver",
        "order:ver_todos",
        "blacklist:gestionar", 
    },
    "operaciones": {
        "product:gestionar",
        "document:revisar", "document:ver",
        "vehicle:ver", "carrier:ver",
        "order:ver_todos",
        "inventory:gestionar", "inventory:ver",
    },
    "soporte": {
        "order:ver_todos", "order:editar_limitado",
        "payment:ver",
        "assignment:ver",
        "dispatch_guide:ver",
        "company:ver",
        "document:ver",
    },
    "cliente_admin": {
        "order:crear", "order:ver_empresa", "order:editar_propio",
        "payment:ver_propio",
        "bank_account:ver",
        "dispatch_guide:ver_propio",
        "assignment:crear_propio", "assignment:ver_propio", 
    },
    "cliente_operativo": {
        "order:crear", "order:ver_propios", "order:editar_propio",
        "payment:ver_propio",
        "bank_account:ver",
        "dispatch_guide:ver_propio",
        "assignment:crear_propio", "assignment:ver_propio",   
    },
}


# Obtiene los permisos de acuerdo al rol asignado
def get_permissions_for_role(role: str) -> list[str]:
    return sorted(ROLES_PERMISSIONS.get(role, set()))