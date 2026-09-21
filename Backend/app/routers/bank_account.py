# routers/bank_account.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import BankAccountManager, BankAccountViewer
from app.constants.roles import CLIENT_ROLES
from app.schemas.bank_account import BankAccountCreate, BankAccountResponse
from app.services.bank_account_service import (
    edit_bank_account, get_bank_accounts, get_bank_account_by_id, create_bank_account, deactivate_bank_account,
)

router = APIRouter(prefix="/bank-accounts", tags=["Bank Accounts"])


@router.get("/", response_model=list[BankAccountResponse], summary="Trae la lista de cuentas bancarias.")
def list_bank_accounts(
    current_user: BankAccountViewer,
    db: Session = Depends(get_db),
):
    # los roles de cliente solo ven las activas, para elegir al crear un pedido
    only_active = current_user.role in CLIENT_ROLES
    return get_bank_accounts(db, only_active=only_active)


@router.get("/{bank_account_id}", response_model=BankAccountResponse, summary="Trae la información de 1 cuentas bancaria.")
def get_bank_account(
    bank_account_id: UUID,
    current_user: BankAccountViewer,
    db: Session = Depends(get_db),
):
    bank_account = get_bank_account_by_id(db, bank_account_id)

    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    return bank_account


@router.post("/", response_model=BankAccountResponse, summary="Crea una cuenta bancaria.")
def create_new_bank_account(
    data: BankAccountCreate,
    current_user: BankAccountManager,
    db: Session = Depends(get_db),
):
    return create_bank_account(db, data)


@router.put("/{bank_account_id}", response_model=BankAccountResponse, summary="Actualiza una cuenta bancaria.")
def update_bank_account(
    bank_account_id: UUID,
    data: BankAccountCreate,
    current_user: BankAccountManager,
    db: Session = Depends(get_db),
):
    try:
        account = edit_bank_account(db, bank_account_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.delete("/{bank_account_id}", summary="Desactiva una cuenta bancaria.")
def remove_bank_account(
    bank_account_id: UUID,
    current_user: BankAccountManager,
    db: Session = Depends(get_db),
):
    account = deactivate_bank_account(db, bank_account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return {"detail": "Bank account deactivated"}