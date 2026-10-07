REQUIRED_DOCUMENTS = {
  "juridica": ("camara_comercio", "rut", "cedula_representante"),
  "natural": ("cedula_ciudadania", "rut"),
}

COMMON_CHECKS = ("listas_vinculantes", "antecedentes_judiciales")

CHECKS_BY_SECTOR = {
  "construccion": ("dian_proveedores_ficticios",),
  "agro": ("contrabando",),
}


def get_required_checks(business_sector):
  return COMMON_CHECKS + CHECKS_BY_SECTOR.get(business_sector, ())