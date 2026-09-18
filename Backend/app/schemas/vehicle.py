from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from typing import Literal, Optional

VehicleType = Literal["volqueta", "patineta", "mula"]

class VehicleBase(BaseModel):
    type: str
    capacity_m3: Decimal
    plate: str
    soat_expiration_date: date
    technical_inspection_expiration_date: date


class VehicleCreate(VehicleBase):
    pass


class VehicleResponse(VehicleBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None
    class Config:
        from_attributes = True