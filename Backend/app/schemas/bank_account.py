from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from app.schemas.mixins import AuditResponseMixin


class BankAccountBase(BaseModel):
    bank_name: str
    account_type: str
    account_number: str
    account_holder_name: str    
    account_holder_document_type: str
    account_holder_document_number: str
    agreement_number: Optional[str] = None



class BankAccountCreate(BankAccountBase):
    company_id: UUID


class BankAccountResponse(BankAccountBase, AuditResponseMixin):
    id: UUID
    company_id: UUID
    is_active: bool

    class Config:
        from_attributes = True