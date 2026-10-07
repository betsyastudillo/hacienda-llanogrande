import re
from pydantic import BaseModel, field_validator
from uuid import UUID
from typing import Optional
from app.schemas.mixins import AuditResponseMixin

ACCOUNT_NUMBER_REGEX = re.compile(r"\d{6,20}")

class BankAccountBase(BaseModel):
  bank_name: str
  account_type: str
  account_number: str
  account_holder_name: str    
  account_holder_document_type: str
  account_holder_document_number: str
  agreement_number: Optional[str] = None


class BankAccountCreate(BankAccountBase):
  company_id: Optional[UUID] = None # Si no viene la empresa, se usa la empresa propia (La hacienda, en este caso)

  @field_validator("account_number")
  @classmethod
  def validate_account_number(cls, value):
    if not ACCOUNT_NUMBER_REGEX.fullmatch(value):
      raise ValueError ("El númerode cuenta debe contener solo números (entre 6 y 20 dígitos)")
    
    return value


class BankAccountResponse(BankAccountBase, AuditResponseMixin):
  id: UUID
  company_id: UUID
  is_active: bool

  class Config:
    from_attributes = True