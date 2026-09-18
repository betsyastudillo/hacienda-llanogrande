from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime


class CarrierBase(BaseModel):
    full_name: str
    document_id: str
    phone: str
    address: str
    license_expiration_date: date


class CarrierCreate(CarrierBase):
    pass


class CarrierResponse(CarrierBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None
    class Config:
        from_attributes = True