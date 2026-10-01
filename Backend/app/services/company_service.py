from typing import Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.company import Company
from app.schemas.company import CompanyBase, CompanyCreate, CompanyResponse


VALID_PERSON_TYPES = ("natural", "juridica")
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


# Trae todas las empresas
def get_companies(db: Session, company_type: Optional[str] = None) -> list[Company]:
  query = db.query(Company)

  if company_type:
    query = query.filter(Company.type == company_type)

  return query.all()


# Buscador de empresas por id (UUID)
def get_company_by_id(db: Session, company_id: UUID) -> Optional[Company]:
  return db.query(Company).filter(Company.id == company_id).first()


# Buscador de empresas por client_code (identificador de la empresa por facilidad de "aprendizaje")
def get_company_by_client_code(db: Session, client_code: str) -> Optional[Company]:
  return db.query(Company).filter(Company.client_code == client_code).first()


# Generación del código del cliente
def generate_client_code(db: Session, company_type: str) -> str:
  prefix = "HAC" if company_type == "own" else "CLI"
  existing_count = db.query(Company).filter(Company.type == company_type).count()
  next_number = existing_count + 1
  
  return f"{prefix}-{next_number:04d}"


# Crea una empresa
def create_a_company(db: Session, company: CompanyCreate) -> Company:
  _validate_person_type(company.person_type)   
  _validate_business_sector(company.type, company.business_sector)


  # El client_code se genera automáticamente, no se asigna ni se elige.
  new_company = Company(
      legal_name=company.legal_name,
      display_name=company.display_name,
      nit=company.nit,
      type=company.type,
      business_sector=company.business_sector,
      person_type=company.person_type,
      address=company.address,
      phone=company.phone,
      email=company.email,
      fiscal_address= company.fiscal_address,
      fiscal_phone= company.fiscal_phone,
      fiscal_email= company.fiscal_email,
      client_code=generate_client_code(db, company.type),
      verification_status="pending"  # Se crea por defecto, ya que requiere verificación de la documentación para aprobarse
  )

  db.add(new_company)
  db.commit()
  db.refresh(new_company)
  
  return new_company


# Editar 
def edit_company(db: Session, company_id: UUID, company_update: CompanyCreate) -> Optional[Company]:
    company = get_company_by_id(db, company_id)

    if not company:
        return None

    _validate_person_type(company_update.person_type)
    _validate_business_sector(company_update.type, company_update.business_sector)

    # Se agrega campo por campo para evitar asignación masiva
    company.legal_name = company_update.legal_name
    company.display_name = company_update.display_name
    company.nit = company_update.nit
    company.type = company_update.type
    company.person_type = company_update.person_type
    company.address = company_update.address
    company.phone = company_update.phone
    company.email = company_update.email
    company.fiscal_address = company_update.fiscal_address
    company.fiscal_phone = company_update.fiscal_phone
    company.fiscal_email = company_update.fiscal_email

    db.commit()
    db.refresh(company)

    return company


def deactivate_company(db: Session, company_id: UUID) -> Optional[Company]:
  company = get_company_by_id(db, company_id)
  
  if not company:
    return None

  company.is_active = False
  
  db.commit()
  
  return company


# Verificación (admin) de la empresa creada.
def verify_company(db: Session, company_id: UUID, decision: str, rejection_reason: Optional[str], current_user) -> Optional[Company]:
  company = get_company_by_id(db, company_id)

  if not company:
    return None

  if company.verification_status != "pending":
    raise ValueError(f"Esta empresa ya fue {company.verification_status}")

  if decision == "rejected" and not rejection_reason:
    raise ValueError("Rechazar requiere un motivo")

  company.verification_status = decision
  company.rejection_reason = rejection_reason if decision == "rejected" else None
  company.verified_at = datetime.utcnow()
  company.verified_by_user_id = current_user.id

  db.commit()
  db.refresh(company)

  return company