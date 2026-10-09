from typing import Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from app.constants.company_requirements import REQUIRED_DOCUMENTS, get_required_checks
from app.schemas.company import LEGAL_REP_FIELDS, CompanyBase, CompanyCreate, CompanyResponse
from app.models.company import Company
from app.models.document import Document
from app.models.compliance_check import ComplianceCheck

VALID_PERSON_TYPES = ("natural", "juridica")
VALID_NATURAL_DOCUMENT_TYPES = ("CC", "CE", "PP", "PPT", "PEP", "otro")
VALID_BUSINESS_SECTORS = ("construccion", "agro")


def _validate_person_type(person_type: str):
  if person_type not in VALID_PERSON_TYPES:
    raise ValueError(f"Invalid person_type. Allowed values: {VALID_PERSON_TYPES}")


def _validate_business_sector(company_type: str, business_sector: Optional[str]):
  if company_type == "client":
    if not business_sector:
      raise ValueError("business_sector es obligatorio para empresas cliente")
    if business_sector not in VALID_BUSINESS_SECTORS:
      raise ValueError(f"Invalid business_sector. Allowed values: {VALID_BUSINESS_SECTORS}")


def _resolve_document_type(person_type: str, document_type: Optional[str]) -> str:
  if person_type == "juridica":
    return "NIT"  # Fijo porque una PJ solo puede tener NIT como documento válido

  if not document_type or document_type not in VALID_NATURAL_DOCUMENT_TYPES:
    raise ValueError(f"document_type inválido para persona natural. Valores permitidos: {VALID_NATURAL_DOCUMENT_TYPES}")

  return document_type


# Trae todas las empresas
def get_companies(db: Session, current_user, company_type: Optional[str] = None, include_inactive: bool = False) -> list[Company]:

  query = db.query(Company)

  if company_type:
    query = query.filter(Company.company_type == company_type)

  if not include_inactive:
    query = query.filter(Company.is_active == True)

  return attach_needs_action(db, query.all(), current_user)


# Buscador de empresas por id (UUID)
def get_company_by_id(db: Session, company_id: UUID) -> Optional[Company]:
  return db.query(Company).filter(Company.id == company_id).first()


# Buscador de empresas por client_code (identificador de la empresa por facilidad de "aprendizaje")
def get_company_by_client_code(db: Session, client_code: str) -> Optional[Company]:
  return db.query(Company).filter(Company.client_code == client_code).first()


# Generación del código del cliente
def generate_client_code(db: Session, company_type: str) -> str:
  prefix = "HAC" if company_type == "own" else "CLI"
  existing_count = db.query(Company).filter(Company.company_type == company_type).count()
  next_number = existing_count + 1
  
  return f"{prefix}-{next_number:04d}"


# Crea una empresa
def create_a_company(db: Session, company: CompanyCreate) -> Company:
  _validate_person_type(company.person_type)   
  _validate_business_sector(company.company_type, company.business_sector)


  # El client_code se genera automáticamente, no se asigna ni se elige.
  new_company = Company(
    legal_name=company.legal_name,
    display_name=company.display_name,
    document_type=_resolve_document_type(company.person_type, company.document_type),
    document_number=company.document_number,
    company_type=company.company_type,
    business_sector=company.business_sector,
    person_type=company.person_type,
    address=company.address,
    phone=company.phone,
    email=company.email,
    economic_activity_code=company.economic_activity_code,
    economic_activity_description=company.economic_activity_description,
    fiscal_address= company.fiscal_address,
    fiscal_phone= company.fiscal_phone,
    fiscal_email= company.fiscal_email,
    legal_rep_name=company.legal_rep_name,
    legal_rep_document_type=company.legal_rep_document_type,
    legal_rep_document_number=company.legal_rep_document_number,
    legal_rep_email=company.legal_rep_email,
    legal_rep_city=company.legal_rep_city,
    client_code=generate_client_code(db, company.company_type),
    verification_status="draft"  # La empresa se crea como borrador, mientras se termina el proceso de listas vinculantes y documentación. Para que sea obligatorio todo el proceso.
  )

  db.add(new_company)
  db.commit()
  db.refresh(new_company)
  
  return new_company


def submit_company(db: Session, company_id: UUID, current_user) -> Optional[Company]:
  company = get_company_by_id(db, company_id)

  if not company:
    return None

  if company.verification_status != "draft":
    raise ValueError("Solo se puede enviar a revisión una empresa en borrador")

  if not company.is_active:
    raise ValueError("La empresa está desactivada")

  uploaded_types = {
    d.document_type for d in db.query(Document).filter(Document.company_id == company_id).all()
  }
  missing_docs = [t for t in REQUIRED_DOCUMENTS.get(company.person_type, ()) if t not in uploaded_types]
  
  if missing_docs:
    raise ValueError(f"Faltan documentos obligatorios: {', '.join(missing_docs)}")

  checks = db.query(ComplianceCheck).filter(ComplianceCheck.company_id == company_id).all()
  saved_keys = {c.check_key for c in checks}
  missing_checks = [k for k in get_required_checks(company.business_sector) if k not in saved_keys]
  
  if missing_checks:
    raise ValueError(f"Falta completar la verificación en listas: {', '.join(missing_checks)}")

  for c in checks:
    if c.has_findings and not (c.note and c.note.strip()):
      raise ValueError("Los hallazgos en listas requieren una descripción")

  company.verification_status = "pending"

  db.commit()
  db.refresh(company)

  return company


# Editar 
def edit_company(db: Session, company_id: UUID, company_update: CompanyCreate) -> Optional[Company]:
  company = get_company_by_id(db, company_id)

  if not company:
    return None

  _validate_person_type(company_update.person_type)
  _validate_business_sector(company_update.company_type, company_update.business_sector)

  if company.person_type == "juridica" and not all(getattr(company, f) for f in LEGAL_REP_FIELDS):
    raise ValueError("Faltan los datos del representante legal")
  
  # Se agrega campo por campo para evitar asignación masiva
  company.legal_name = company_update.legal_name
  company.display_name = company_update.display_name
  company.document_type = _resolve_document_type(company_update.person_type, company_update.document_type)
  company.document_number = company_update.document_number
  company.company_type = company_update.company_type
  company.person_type = company_update.person_type
  company.address = company_update.address
  company.phone = company_update.phone
  company.email = company_update.email
  company.economic_activity_code = company_update.economic_activity_code
  company.economic_activity_description = company_update.economic_activity_description
  company.fiscal_address = company_update.fiscal_address
  company.fiscal_phone = company_update.fiscal_phone
  company.fiscal_email = company_update.fiscal_email
  company.legal_rep_name=company_update.legal_rep_name,
  company.legal_rep_document_type=company_update.legal_rep_document_type,
  company.legal_rep_document_number=company_update.legal_rep_document_number,
  company.legal_rep_email=company_update.legal_rep_email,
  company.legal_rep_city=company_update.legal_rep_city,

  db.commit()
  db.refresh(company)

  return company


# Permite cambiar el estado de la empresa
def _check_can_toggle(company: Company, only_drafts: bool):
  if only_drafts and company.verification_status != "draft":
    raise PermissionError("Solo un administrador puede desactivar o reactivar una empresa que ya salió de borrador")


def reactivate_company(db: Session, company_id: UUID, only_drafts: bool = False) -> Optional[Company]:
  company = get_company_by_id(db, company_id)

  if not company:
    return None

  _check_can_toggle(company, only_drafts)
  
  if company.is_active:
    raise ValueError("La empresa ya está activa")

  company.is_active = True
  db.commit()
  db.refresh(company)

  return company


def deactivate_company(db: Session, company_id: UUID, only_drafts: bool = False) -> Optional[Company]:
  company = get_company_by_id(db, company_id)
  
  if not company:
    return None

  _check_can_toggle(company, only_drafts)

  if company.company_type == "own":
    raise ValueError("No se puede desactivar la empresa propia.")
  
  company.is_active = False
  
  db.commit()
  
  return company


# Verificación (admin) de la empresa creada.
def verify_company(db: Session, company_id: UUID, decision: str, rejection_reason: Optional[str], rejection_type: Optional[str], current_user) -> Optional[Company]:
  company = get_company_by_id(db, company_id)

  if not company:
    return None

  if company.verification_status == "draft":
    raise ValueError("La empresa aún no se encuentra creada totalmente, falta completar la verificación en listas vinculantes y la documentación.")
  
  if company.verification_status != "pending":
    raise ValueError(f"Esta empresa ya fue {company.verification_status}")

  if decision == "rejected":
    if not rejection_reason:
      raise ValueError("Rechazar requiere un motivo")
    
    if not rejection_type:
      raise ValueError("Rechazar requiere un tipo de rechazo")

  company.verification_status = decision
  company.rejection_reason = rejection_reason if decision == "rejected" else None
  company.rejection_type = rejection_type if decision == "rejected" else None
  company.verified_at = datetime.utcnow()
  company.verified_by_user_id = current_user.id

  db.commit()
  db.refresh(company)

  return company


def resubmit_company(db: Session, company_id: UUID, current_user) -> Optional[Company]:

  company = get_company_by_id(db, company_id)

  if not company:
    return None

  if company.verification_status != "rejected":
    raise ValueError("Solo se puede reenviar una empresa rechazada")

  if company.rejection_type != "documents":
    raise ValueError("Este rechazo es definitivo y no se puede reenviar")

  still_rejected = db.query(Document).filter(
    Document.company_id == company_id, Document.status == "rejected"
  ).count()

  if still_rejected > 0:
    raise ValueError("Aún hay documentos rechazados sin reemplazar")

  # Se conserva rejection_reason para que admin vea el contexto; se limpia al aprobar
  company.verification_status = "pending"

  db.commit()
  db.refresh(company)

  return company


def attach_needs_action(db: Session, companies: list[Company], current_user) -> list[Company]:
  role = current_user.role
  ids = [c.id for c in companies]

  # Empresas que tienen al menos un documento rechazado (una sola consulta)
  with_rejected_docs = set()
  if ids:
    rows = (
      db.query(Document.company_id)
      .filter(Document.company_id.in_(ids), Document.status == "rejected")
      .distinct()
      .all()
    )
    with_rejected_docs = {r[0] for r in rows}

  for company in companies:
    needs = False

    if company.is_active:
      if role == "admin":
        needs = company.verification_status == "pending"

      elif role == "operaciones":
        needs = (
          company.verification_status == "draft"
          or (company.verification_status == "rejected" and company.rejection_type == "documents")
          or (company.verification_status != "approved" and company.id in with_rejected_docs)
        )

    company.needs_action = needs

  return companies