from typing import Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from app.dependencies import user_has_permission
from app.constants.company_requirements import REQUIRED_DOCUMENTS, get_required_checks_for, LEGAL_REP_FIELDS, VALID_PERSON_TYPES, VALID_NATURAL_DOCUMENT_TYPES, VALID_BUSINESS_SECTORS, EDITABLE_FIELDS, LEGAL_REP_IDENTITY, REQUIRED_FIELDS, VALID_DOCUMENT_TYPES, VALID_LEGAL_REP_DOCUMENT_TYPES, LEGAL_REP_FIELDS
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.models.company import Company
from app.models.document import Document
from app.models.compliance_check import ComplianceCheck


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
def get_companies(db: Session, current_user, company_type: Optional[str] = None, include_inactive: bool = False, verification_status=None) -> list[Company]:

  query = db.query(Company)

  if company_type:
    query = query.filter(Company.company_type == company_type)

  if not include_inactive:
    query = query.filter(Company.is_active == True)

  if verification_status:
    query = query.filter(Company.verification_status == verification_status)

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
def create_a_company(db: Session, company: CompanyCreate, current_user) -> Company:
  
  doc_type = _resolve_document_type(company.person_type, company.document_type)
  doc_number = company.document_number.strip()

  existing = (
    db.query(Company)
    .filter(Company.document_type == doc_type, Company.document_number == doc_number)
    .first()
  )

  if existing:
    # Si fue rechazada de forma definitiva, no permite
    if existing.verification_status == "rejected" and existing.rejection_type == "compliance":
      raise ValueError("Este documento fue rechazado de forma definitiva y no puede registrarse de nuevo.")

    # Si está desactivada, solicita la reactivación al admin
    if not existing.is_active:
      raise ValueError(
        f"Ya existe una empresa con ese documento ({existing.document_number}), pero está desactivada. "
        "Comunícate con el administrador para que la reactive; luego podrás actualizar sus datos."
      )
    
    # Si fue rechazada por documentos se corrige en la misma, no crea otra
    if existing.verification_status == "rejected":
      raise ValueError(
        f"Ya existe una empresa con ese documento ({existing.document_number}), rechazada por documentos. "
        "Ábrela desde el listado, reemplaza los documentos y reenvíala a revisión."
      )
    
    #Si está en borrador o pendiente o aprobada
    raise ValueError(f"Ya existe una empresa con ese documento ({existing.document_number}). Verifica el tipo y número de documento y vuelve a intentarlo.")
  

  _validate_person_type(company.person_type)   
  _validate_business_sector(company.company_type, company.business_sector)


  # El client_code se genera automáticamente, no se asigna ni se elige.
  new_company = Company(
    legal_name=company.legal_name,
    display_name=company.display_name,
    document_type=doc_type,
    document_number=doc_number,
    company_type=company.company_type,
    business_sector=company.business_sector,
    person_type=company.person_type,
    address=company.address,
    phone=company.phone,
    email=company.email,
    country=company.country,
    department=company.department,
    city=company.city,
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
    verification_status="draft",  # La empresa se crea como borrador, mientras se termina el proceso de listas vinculantes y documentación. Para que sea obligatorio todo el proceso.
    created_by_user_id=current_user.id
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
  
  # Representante legal (solo personas jurídicas)
  is_juridica = company.person_type == "juridica"

  if is_juridica and not all((getattr(company, f) or "").strip() for f in LEGAL_REP_FIELDS):
    raise ValueError("Faltan los datos del representante legal")

  # Documentos
  uploaded_types = {
    d.document_type for d in db.query(Document).filter(Document.company_id == company_id).all()
  }

  missing_docs = [t for t in REQUIRED_DOCUMENTS.get(company.person_type, ()) if t not in uploaded_types]
  
  if missing_docs:
    raise ValueError(f"Faltan documentos obligatorios: {', '.join(missing_docs)}")
  
  # Verificación en listas, por sujeto
  checks = db.query(ComplianceCheck).filter(ComplianceCheck.company_id == company_id).all()
  saved = {(c.subject, c.check_key) for c in checks}

  subjects = ["company"] + (["legal_representative"] if is_juridica else [])

  for subject in subjects:
    missing = [
      k for k in get_required_checks_for(company.business_sector, subject)
      if (subject, k) not in saved
    ]

    if missing:
      who = "del representante legal" if subject == "legal_representative" else "de la empresa"
      raise ValueError (f"Falta completar la verificación en listas {who}: {', '.join(missing)}")
    
  for c in checks:
    if c.has_findings and not (c.note and c.note.strip()):
      raise ValueError("Los hallazgos en listas requieren una descripción")  

  company.verification_status = "pending"

  db.commit()
  db.refresh(company)

  return company


# Editar 
def edit_company(db: Session, company_id: UUID, company_update: CompanyUpdate, current_user) -> Optional[Company]:
  company = get_company_by_id(db, company_id)

  if not company:
    return None

  if not company.is_active:
    raise ValueError("La empresa está desactivada")
  
  if company.verification_status == "rejected" and company.rejection_type == "compliance":
    raise ValueError("La empresa fue rechazada de forma definitiva y no se puede editar")
  
  if company.verification_status not in ("draft", "rejected", "approved"):
    raise ValueError("No se puede editar mientras está en revisión")

  # model_dump(exclude_unset=True) convierte el obj en dict pero solo los campos que el cliente envía en la petición, los que no, se omiten
  changes = company_update.model_dump(exclude_unset=True)

  # Campos de la lista blanca que llegaron y cuyo valor es distinto al actual.
  changed = {f for f in EDITABLE_FIELDS if f in changes and changes[f] != getattr(company, f)}

  # Una persona natural no tiene rep.legal
  if company.person_type != "juridica":
    changed -= set(LEGAL_REP_FIELDS)

  if not changed:
    return company # Si no hay nada que guardar, no se toca el estado
  
  for f in changed & REQUIRED_FIELDS:
    if not (changes[f] or "").strip():
      raise ValueError("Los campos obligatorios no pueden quedar vacíos")
    
  for f in changed:
    setattr(company, f, changes[f])

  # Se valida con los valores YA aplicados, para que se pueda completar un representante faltante
  if company.person_type == "juridica":
    if not all((getattr(company, f) or "").strip() for f in LEGAL_REP_FIELDS):
      db.rollback() # Deshace los cambios aplicadoa arriba
      raise ValueError("Faltan los datos del representante legal")
  
  # Solo quien NO puede aprobar manda la empresa de nuevo a revisión
  if company.verification_status == "approved" and not user_has_permission(current_user, "company:aprobar"):
    if changed & LEGAL_REP_IDENTITY:
      # Si cambió el rep. legal, hay que repetir las listas vinculantes del rep.
      db.query(ComplianceCheck).filter(
        ComplianceCheck.company_id == company_id,
        ComplianceCheck.subject == "legal_representative",
      ).delete()
      company.verification_status = "draft"
    
    else:
      company.verification_status = "pending"

    company.verified_at = None
    company.verified_by_user_id = None
    
  company.updated_by_user_id = current_user.id
  
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