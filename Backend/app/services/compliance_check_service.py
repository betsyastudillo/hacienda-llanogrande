from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.compliance_check import ComplianceCheck
from app.models.company import Company
from app.constants.company_requirements import get_required_checks


def get_checks_by_company(db: Session, company_id: UUID) -> List[ComplianceCheck]:
  return db.query(ComplianceCheck).filter(ComplianceCheck.company_id == company_id).all()


# Insertar si ya existe, no crea otro
def upsert_check(db: Session, company_id: UUID, check_key: str, has_findings: bool, note: Optional[str], current_user) -> ComplianceCheck:
  company = db.query(Company).filter(Company.id == company_id).first()

  if not company:
    raise ValueError("Company not found")

  if company.verification_status != "draft":
    raise ValueError("La verificación en listas solo se puede modificar mientras la empresa es un borrador")

  if check_key not in get_required_checks(company.business_sector):
    raise ValueError("Esa verificación no aplica al sector de esta empresa")

  if has_findings and not (note and note.strip()):
    raise ValueError("Los hallazgos requieren una descripción")

  # Si no hay hallazgos no se guarda nota, para no dejar texto viejo de una marca anterior
  clean_note = note.strip() if has_findings else None

  existing = (
    db.query(ComplianceCheck)
    .filter(ComplianceCheck.company_id == company_id, ComplianceCheck.check_key == check_key)
    .first()
  )

  if existing:
    existing.has_findings = has_findings
    existing.note = clean_note
    existing.updated_by_user_id = current_user.id
    db.commit()
    db.refresh(existing)
    
    return existing

  new_check = ComplianceCheck(
    company_id=company_id,
    check_key=check_key,
    has_findings=has_findings,
    note=clean_note,
    created_by_user_id=current_user.id,
  )

  db.add(new_check)
  db.commit()
  db.refresh(new_check)

  return new_check