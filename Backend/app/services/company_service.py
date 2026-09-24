from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.company import Company
from app.schemas.company import CompanyBase, CompanyCreate, CompanyResponse


# Trae todas las empresas
def get_companies(db: Session) -> list[Company]:
    return db.query(Company).filter(Company.is_active == True).all()


# Buscador de empresas por id (UUID)
def get_company_by_id(db: Session, company_id: UUID) -> Optional[Company]:
    return db.query(Company).filter(Company.id == company_id).first()


# Buscador de empresas por client_code (identificador de la empresa por facilidad de "aprendizaje")
def get_company_by_client_code(db: Session, client_code: str) -> Optional[Company]:
    return db.query(Company).filter(Company.client_code == client_code).first()


# Generación del código del cliente
def generate_client_code(db: Session, company_type: CompanyCreate) -> Company:
    # Agrega el prefijo distintivo para clientes o la propia empresa 
    prefix = "HAC" if company_type == "own" else "CLI"

    #
    existing_count = db.query(Company).filter(Company.type == company_type).count()

    #
    next_number = existing_count + 1

    return f"{prefix}-{next_number:04d}"


# Crea una empresa
def create_a_company(db: Session, company: CompanyCreate) -> Company:
    
    # El client_code se genera automáticamente, no se asigna ni se elige.

    new_company = Company(
        legal_name=company.legal_name,
        display_name=company.display_name,
        nit=company.nit,
        type=company.type,
        address=company.address,
        phone=company.phone,
        email=company.email,
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

    # Se agrega campo por campo para evitar asignación masiva
    company.legal_name = company_update.legal_name
    company.display_name = company_update.display_name
    company.nit = company_update.nit
    company.type = company_update.type
    company.address = company_update.address
    company.phone = company_update.phone
    company.email = company_update.email

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