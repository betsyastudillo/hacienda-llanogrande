from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel
from uuid import UUID
from app.schemas.mixins import AuditResponseMixin


class CompanyBase (BaseModel):
    legal_name: str
    display_name: Optional[str] = None
    document_type: Optional[str] = None
    document_number: str
    company_type: str
    business_sector: Optional[Literal["construccion", "agro"]] = None
    person_type: str = "juridica"
    address: str
    phone: str
    email: str
    fiscal_address : Optional[str] = None
    fiscal_phone : Optional[str] = None
    fiscal_email : Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyVerifyRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    rejection_reason: Optional[str] = None

class CompanyResponse(CompanyBase, AuditResponseMixin):
    id: UUID
    client_code: str
    verification_status: str
    verified_at: Optional[datetime] = None
    verified_by_user_id: Optional[UUID] = None
    rejection_reason: Optional[str] = None


    class Config:
        from_attributes = True