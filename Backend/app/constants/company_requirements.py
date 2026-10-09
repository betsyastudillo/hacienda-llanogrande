REQUIRED_DOCUMENTS = {
  "juridica": ("camara_comercio", "rut", "cedula_representante"),
  "natural": ("cedula_ciudadania", "rut"),
}

COMMON_CHECKS = ("listas_vinculantes", "antecedentes_judiciales", "inspektor", "datacredito", "cifin")

CHECKS_BY_SECTOR = {
  "construccion": ("dian_proveedores_ficticios",),
  "agro": ("contrabando",),
}

LEGAL_REP_FIELDS = (
  "legal_rep_name", "legal_rep_document_type", "legal_rep_document_number",
  "legal_rep_email", "legal_rep_city",
)

def get_required_checks(business_sector):
  return COMMON_CHECKS + CHECKS_BY_SECTOR.get(business_sector, ())

def get_required_checks_for(business_sector, subject: str):
  # Al representante legal solo le aplican las comunes
  if subject == "legal_representative":
    return list(COMMON_CHECKS)
  
  return get_required_checks(business_sector)