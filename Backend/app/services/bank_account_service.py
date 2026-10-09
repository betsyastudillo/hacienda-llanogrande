from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.bank_account import BankAccount
from app.models.company import Company
from app.schemas.bank_account import BankAccountCreate

VALID_ACCOUNT_TYPES = ("ahorros", "corriente")
VALID_HOLDER_DOCUMENT_TYPES = ("NIT", "CC", "CE", "PP")


def _validate_fields(data: BankAccountCreate):
  if data.account_type not in VALID_ACCOUNT_TYPES:
    raise ValueError(f"Invalid account_type. Allowed values: {VALID_ACCOUNT_TYPES}")
  
  if data.account_holder_document_type not in VALID_HOLDER_DOCUMENT_TYPES:
    raise ValueError(f"Invalid account_holder_document_type. Allowed values: {VALID_HOLDER_DOCUMENT_TYPES}")
  

def _resolve_company_id(db: Session, company_id: Optional[UUID]) -> UUID:
  
  # Si viene sin company_id se usa el de la hacienda, y si viene, se valida que si sea
  if company_id is None:
    own = db.query(Company).filter(Company.company_type == "own").first()

    if not own:
      raise ValueError("No existe la empresa propia de la hacienda.")
    
    return own.id
  
  company = db.query(Company).filter(Company.id == company_id).first()

  if not company:
    raise ValueError("Company not found")
  
  if company.company_type != "own":
    raise ValueError("Banks accounts can only be linkes to the hacienda's own company")
  
  return company.id


def _check_duplicate(db: Session, bank_name: str, account_number: str, exclude_id: Optional[UUID] = None):
  query = db.query(BankAccount).filter(
    BankAccount.bank_name == bank_name,
    BankAccount.account_number == account_number,
    BankAccount.is_active == True,
  )

  if exclude_id:
    query = query.filter(BankAccount.id != exclude_id)

  if query.first():
    raise ValueError("Ya existe una cuenta activa con ese banco y ese número")


def get_bank_accounts(db:Session, current_user, only_active: bool =False) -> List[BankAccount]:

  query = db.query(BankAccount)

  # Los clientes solo ven cuentas activas, sin importar lo que pidan
  if current_user.role in ("cliente_admin", "cliente_operativo"):
    only_active = True

  if only_active:
    query = query.filter(BankAccount.is_active == True)

  return query.all()


def get_bank_account_by_id(db: Session, bank_account_id: UUID) -> Optional[BankAccount]:
  return db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()


def create_bank_account(db: Session, data: BankAccountCreate) -> BankAccount:
  
  _validate_fields(data)
  company_id = _resolve_company_id(db, data.company_id)
  _check_duplicate(db, data.bank_name, data.account_number)

  new_account = BankAccount(
    company_id=company_id,
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
  
  _validate_fields(data)
  company_id = _resolve_company_id(db, data.company_id)
  _check_duplicate(db, data.bank_name, data.account_number, exclude_id=account.id)

  account.company_id = company_id
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


def reactivate_bank_account(db: Session, bank_account_id: UUID) -> Optional[BankAccount]:
  account = get_bank_account_by_id(db, bank_account_id)

  if not account:
    return None

  if account.is_active:
    raise ValueError("La cuenta ya está activa")

  # Se valida, ya que pudo haberse creado otra igual mientras estaba desactivada
  _check_duplicate(db, account.bank_name, account.account_number, exclude_id=account.id)

  account.is_active = True
  db.commit()
  db.refresh(account)

  return account