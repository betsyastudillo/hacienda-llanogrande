from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.bank_account import BankAccount
from app.models.company import Company
from app.schemas.bank_account import BankAccountCreate

def get_bank_accounts(db:Session, only_active: bool =False) -> List[BankAccount]:
    query = db.query(BankAccount)

    if only_active:
        query = query.filter(BankAccount.is_active == True)
    
    return query.all()


def get_bank_account_by_id(db: Session, bank_account_id: UUID) -> Optional[BankAccount]:
    return db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()


def create_bank_account(db: Session, data: BankAccountCreate) -> BankAccount:
    
    new_account = BankAccount(
        company_id=data.company_id,
        bank_name=data.bank_name,
        account_type=data.account_type,
        account_number=data.account_number,
        account_holder_name=data.account_holder_name,
        account_holder_document_type=data.account_holder_document_type,
        account_holder_document_number=data.account_holder_document_number,
        agreement_number=data.agreement_number,
    )

    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    return new_account


def edit_bank_account(db: Session, bank_account_id: UUID, data: BankAccountCreate) -> Optional[BankAccount]:
    account = get_bank_account_by_id(db, bank_account_id)

    if not account:
        return None
    
    company = db.query(Company).filter(Company.id == data.company_id).first()

    if not company:
        raise ValueError("Company not found")
    
    if company.type != "own":
        raise ValueError("Bank accounts can only be linked to the hacienda's own company")
    
    account.company_id = data.company_id
    account.bank_name = data.bank_name
    account.account_type = data.account_type
    account.account_number = data.account_number
    account.account_holder_name = data.account_holder_name
    account.account_holder_document_type = data.account_holder_document_type
    account.account_holder_document_number = data.account_holder_document_number
    account.agreement_number = data.agreement_number

    db.commit()
    db.refresh(account)

    return account


def deactivate_bank_account(db: Session, bank_account_id: UUID) -> Optional[BankAccount]:
    account = get_bank_account_by_id(db, bank_account_id)

    if not account:
        return None
    
    account.is_active = False

    db.commit()

    return account
