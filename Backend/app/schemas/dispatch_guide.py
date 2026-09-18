from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class DispatchGuideCreate(BaseModel):
    order_id: UUID


class DispatchGuideResponse(BaseModel):
    id: UUID
    order_id: UUID
    status: str
    origin: str
    destination: str
    cargo_detail: str
    qr_image_url: Optional[str] = None
    used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None
    class Config:
        from_attributes = True


# Es diferente a DispatchGuideResponse porque es lo que va a ver el vigilante al escanear
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