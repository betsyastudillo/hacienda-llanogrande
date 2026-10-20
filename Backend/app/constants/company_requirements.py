REQUIRED_DOCUMENTS = {
  "juridica": ("camara_comercio", "rut", "cedula_representante"),
  "natural": ("cedula_ciudadania", "rut"),
}

COMMON_CHECKS = ("listas_vinculantes", "antecedentes_judiciales", "inspektor", "datacredito", "cifin")

CHECKS_BY_SECTOR = {
  "construccion": ("dian_proveedores_ficticios",),
  "agro": ("contrabando",),
}

# Datos del representante legal (obligatorios para PJ)
LEGAL_REP_FIELDS = (
  "legal_rep_name", "legal_rep_document_type", "legal_rep_document_number",
  "legal_rep_email", "legal_rep_city",
)

# Campos que se pueden editar después de crear la empresa
# Quedan fuera los de identidad: documento, razón social, tipo de persona y sector.
EDITABLE_FIELDS = (
  "display_name", "address", "phone", "email",
  "country", "department", "city",
  "economic_activity_code", "economic_activity_description",
  "fiscal_address", "fiscal_phone", "fiscal_email",
  "legal_rep_name", "legal_rep_document_type", "legal_rep_document_number",
  "legal_rep_email", "legal_rep_city",
) + LEGAL_REP_FIELDS

#Si cambia alguno de estos, es otra persona, por lo tanto hay que repetir su verificación en listas
LEGAL_REP_IDENTITY = {"legal_rep_name", "legal_rep_document_type", "legal_rep_document_number"}
VALID_DOCUMENT_TYPES = ("NIT", "CC", "CE", "PP", "PPT", "PEP")
VALID_LEGAL_REP_DOCUMENT_TYPES = ("CC", "CE", "PP", "PPT", "PEP")
VALID_PERSON_TYPES = ("natural", "juridica")
VALID_NATURAL_DOCUMENT_TYPES = ("CC", "CE", "PP", "PPT", "PEP", "otro")
VALID_BUSINESS_SECTORS = ("construccion", "agro")
VALID_REJECTION_TYPES = ("documents", "compliance")

# Campos que no se pueden dejar vacíos al editar
REQUIRED_FIELDS = {"address", "phone", "email", "country", "department", "city"}


def get_required_checks(business_sector):
  return COMMON_CHECKS + CHECKS_BY_SECTOR.get(business_sector, ())

def get_required_checks_for(business_sector, subject: str):
  # Al representante legal solo le aplican las comunes
  if subject == "legal_representative":
    return list(COMMON_CHECKS)
  
  return get_required_checks(business_sector)