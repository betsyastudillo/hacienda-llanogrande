from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import date
from typing import Literal, Optional
from app.schemas.mixins import AuditResponseMixin

class VehicleBase(BaseModel):
  type: str
  capacity_m3: Decimal
  plate: str


class VehicleCreate(VehicleBase):
  owner_name: str
  owner_document_type: str
  owner_document_id: str
  owner_phone: Optional[str] = None


class VehicleResponse(VehicleBase, AuditResponseMixin):
  id: UUID
  is_active: bool
  owner_name: Optional[str] = None
  owner_document_type: Optional[str] = None
  owner_document_id: Optional[str] = None
  owner_phone: Optional[str] = None

  class Config:
    from_attributes = True