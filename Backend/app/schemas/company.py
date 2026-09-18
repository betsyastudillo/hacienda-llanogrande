from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class CompanyBase (BaseModel):
    legal_name: str
    nit: str
    type: str
    address: str
    phone: str
    email: str

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: UUID
    client_code: str
    verification_status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None

    class Config:
        from_attributes = True