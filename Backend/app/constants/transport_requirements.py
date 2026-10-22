# Reglas de negocio del transporte (vehículo y transportador).

# Documentos obligatorios por sujeto
REQUIRED_VEHICLE_DOCUMENTS = ("soat", "tarjeta_propiedad")
OWNER_DOCUMENT = "documento_propietario"
REQUIRED_CARRIER_DOCUMENTS = ("cedula", "licencia_conduccion")

# Lo que se exige siempre
REQUIRED_DOCUMENTS_BY_SUBJECT = {
  "vehicle": REQUIRED_VEHICLE_DOCUMENTS,
  "carrier": REQUIRED_CARRIER_DOCUMENTS,
}

# Lo que se puede subir: con el documento el dueño
ALLOWED_DOCUMENTS_BY_SUBJECT = {
  "vehicle": REQUIRED_VEHICLE_DOCUMENTS + (OWNER_DOCUMENT,),
  "carrier": REQUIRED_CARRIER_DOCUMENTS,
}

VALID_CARRIER_DOCUMENT_TYPES = ("CC", "CE", "PP", "PPT", "PEP")
VALID_VEHICLE_TYPES = ("camioneta", "camion_sencillo", "doble_troque", "tractomula", "volqueta")
VALID_OWNER_DOCUMENT_TYPES = ("CC", "CE", "PP", "PPT", "PEP", "NIT")

# Las placas vetadas se guardan en DocumentBlacklist con este tipo de documento
PLATE_BLACKLIST_TYPE = "PLACA"

# Archivos de documentos de transporte
TRANSPORT_ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".webp")
TRANSPORT_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Estados de la asignación en los que el cliente todavía puede subir o reemplazar documentos
EDITABLE_ASSIGNMENT_STATUSES = ("pending", "rejected")


# Documentos obligatorios que faltan para un vehículo y un transportador, como "vehicle:soat".
# Un documento rechazado cuenta como faltante. `documents` es cualquier lista de objetos con vehicle_id, carrier_id, document_type y status (modelo Document), por eso no se importa el modelo aquí.
def compute_missing_documents(vehicle_id, carrier_id, documents, owner_is_carrier: bool = False) -> list[str]:
  have = set()

  for d in documents:
    if d.status == "rejected":
      continue
    if d.vehicle_id is not None and d.vehicle_id == vehicle_id:
      have.add(("vehicle", d.document_type))
    elif d.carrier_id is not None and d.carrier_id == carrier_id:
      have.add(("carrier", d.document_type))

  missing = []
  
  for subject, required in REQUIRED_DOCUMENTS_BY_SUBJECT.items():
    for doc_type in required:
      if (subject, doc_type) not in have:
        missing.append(f"{subject}:{doc_type}")

  # El documento del dueño se pide solo si el dueño no es el transportador
  if not owner_is_carrier and ("vehicle", OWNER_DOCUMENT) not in have:
    missing.append(f"vehicle:{OWNER_DOCUMENT}")

  return missing


# Deja la placa en mayúsculas y sin espacios ni guiones: "abc-123" -> "ABC123"
def normalize_plate(plate: str) -> str:
  return "".join(ch for ch in (plate or "") if ch.isalnum()).upper()
