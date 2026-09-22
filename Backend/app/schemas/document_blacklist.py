from pydantic import BaseModel
from uuid import UUID
from app.schemas.mixins import AuditResponseMixin


class DocumentBlacklistCreate(BaseModel):
    document_type: str
    document_number: str
    reason: str


class DocumentBlacklistResponse(AuditResponseMixin):
    id: UUID
    document_type: str
    document_number: str
    reason: str
    is_active: bool

    class Config:
        from_attributes = True