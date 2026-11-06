from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.schemas.mixins import AuditResponseMixin

class DispatchGuideCreate(BaseModel):
  assignment_id: UUID   # antes order_id: ahora la guía es de un retiro

class DispatchGuideResponse(AuditResponseMixin):
  id: UUID
  assignment_id: UUID
  balance_detail: Optional[str] = None
  status: str
  origin: str
  destination: str
  cargo_detail: str
  qr_image_url: Optional[str] = None
  entered_at: Optional[datetime] = None
  used_at: Optional[datetime] = None

  class Config:
    from_attributes = True


# Es diferente a DispatchGuideResponse porque es lo que va a ver el vigilante al escanear el QR
class VerificationResponse(BaseModel):
  order_id: UUID
  status: str
  origin: str
  destination: str
  cargo_detail: str
  carrier_name: str
  carrier_document: str
  vehicle_plate: str
  vehicle_type: str
  blocked: bool
  entered_at: Optional[datetime] = None
  used_at: Optional[datetime] = None
  can_enter: bool
  can_exit: bool
  order_number: str
  sequence: int
  balance_detail: Optional[str] = None