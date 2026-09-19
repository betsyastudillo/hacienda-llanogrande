from typing import List
from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import require_role, get_current_user
from app.models.company import Company
from app.schemas.company import CompanyBase, CompanyCreate, CompanyResponse
from app.constants.roles import CAN_VIEW_COMPANIES, CAN_MANAGE_COMPANIES
from app.services.company_service import create_a_company, get_companies, edit_company, deactivate_company, get_company_by_client_code, get_company_by_id

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.get("/", response_model=List[CompanyResponse],         summary="Lista todas las empresas registradas activas")
def list_companies(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_VIEW_COMPANIES)),
):
    return get_companies(db)


@router.get("/id/{company_id}", response_model=CompanyResponse,        summary="Busca una empresa por ID")
def get_a_company_by_id(
    company_id: UUID, 
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_VIEW_COMPANIES)),
):
    company = get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("/code/{client_code}", response_model=CompanyResponse, summary="Busca una empresa por código del cliente")
def get_a_company_by_client_code(
    client_code: str, 
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_VIEW_COMPANIES)),
):
    company = get_company_by_client_code(db, client_code)

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.post("/", response_model=CompanyResponse, summary="Crea una empresa")
def create_company(
    company: CompanyCreate, 
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_MANAGE_COMPANIES)),
):
    return create_a_company(db=db, company=company)


@router.put("/{company_id}", response_model=CompanyResponse, summary="Edita los datos de una empresa")
def update_company(
    company_id: UUID, 
    company_update: CompanyCreate, 
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_MANAGE_COMPANIES)),
):
    company = edit_company(db, company_id, company_update)

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.delete("/{company_id}", summary="Desactiva una empresa")
def remove_company(
    company_id: UUID, 
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_MANAGE_COMPANIES)),
):
    company = deactivate_company(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"detail": "Company deactivated successfully"}
    