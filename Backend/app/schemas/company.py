from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from app.schemas.mixins import AuditResponseMixin


class CompanyBase (BaseModel):
    legal_name: str
    display_name: Optional[str] = None
    nit: str
    type: str
    address: str
    phone: str
    email: str

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase, AuditResponseMixin):
    id: UUID
    client_code: str
    verification_status: str

    class Config:
        from_attributes = True