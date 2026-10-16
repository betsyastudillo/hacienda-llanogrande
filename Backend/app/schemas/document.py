from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from app.schemas.mixins import AuditResponseMixin

class DocumentBase(AuditResponseMixin):
    id: UUID
    # Un documento pertenece a UNA empresa, un vehículo o un transportador; los otros dos quedan en None
    company_id: Optional[UUID] = None
    vehicle_id: Optional[UUID] = None
    carrier_id: Optional[UUID] = None
    document_type: str
    document_url: str
    status: str

    class Config:
        from_attributes = True


class DocumentStatusUpdate(BaseModel):
    status: str