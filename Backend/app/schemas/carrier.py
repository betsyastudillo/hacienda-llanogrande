from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from app.schemas.mixins import AuditResponseMixin


class CarrierBase(BaseModel):
    full_name: str
    document_id: str
    phone: str
    address: str
    license_expiration_date: date


class CarrierCreate(CarrierBase):
    pass


class CarrierResponse(CarrierBase, AuditResponseMixin):
    id: UUID
    is_active: bool

    class Config:
        from_attributes = True