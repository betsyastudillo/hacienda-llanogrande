from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Literal
from app.database import get_db
from app.auth_dependencies import CompanyManager, CompanyViewer
from app.schemas.compliance_check import ComplianceCheckUpsert, ComplianceCheckResponse
from app.services.compliance_check_service import get_checks_by_company, upsert_check

router = APIRouter(prefix="/compliance-checks", tags=["Compliance Checks"])


@router.get("/company/{company_id}", response_model=list[ComplianceCheckResponse], summary="Lista todos los verificaciones de cumplimiento (listas vinculantes) de una empresa")
def list_checks(
  company_id: UUID,
  current_user: CompanyViewer,
  db: Session = Depends(get_db),
):
    return get_checks_by_company(db, company_id)


@router.put("/company/{company_id}/{check_key}", response_model=ComplianceCheckResponse, summary="Crea o actualiza una verificación de cumplimiento (listas vinculantes) para una empresa")
def upsert_check_endpoint(
  company_id: UUID,
  check_key: str,
  data: ComplianceCheckUpsert,
  current_user: CompanyManager,
  subject: Literal["company", "legal_representative"] = "company",
  db: Session = Depends(get_db),
):
  try:
    return upsert_check(db, company_id, check_key, data.has_findings, data.note, current_user, subject)
  
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))