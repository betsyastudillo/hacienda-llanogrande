from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from app.schemas.mixins import AuditResponseMixin

class DocumentBase(AuditResponseMixin):
    id: UUID
    company_id: UUID
    document_type: str
    document_url: str
    status: str

    class Config:
        from_attributes = True


class DocumentStatusUpdate(BaseModel):
    status: str