from typing import List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.compliance_check import ComplianceCheck


def get_checks_by_company(db: Session, company_id: UUID) -> List[ComplianceCheck]:
  return db.query(ComplianceCheck).filter(ComplianceCheck.company_id == company_id).all()


# Insertar si ya existe, no crea otro
def upsert_check(db: Session, company_id: UUID, check_key: str, has_findings: bool, note: str, current_user) -> ComplianceCheck:
  existing = (
    db.query(ComplianceCheck)
    .filter(ComplianceCheck.company_id == company_id, ComplianceCheck.check_key == check_key)
    .first()
  )

  if existing:
    existing.has_findings = has_findings
    existing.note = note
    existing.updated_by_user_id = current_user.id
    db.commit()
    db.refresh(existing)
    return existing

  new_check = ComplianceCheck(
    company_id=company_id,
    check_key=check_key,
    has_findings=has_findings,
    note=note,
    created_by_user_id=current_user.id,
  )

  db.add(new_check)
  db.commit()
  db.refresh(new_check)
  
  return new_check