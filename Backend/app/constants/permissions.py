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
        "material:gestionar",
        "document:revisar", "document:ver",
        "vehicle:ver", "carrier:ver",
        "order:ver_todos",
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