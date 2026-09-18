from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import List, Optional
from app.schemas.mixins import AuditResponseMixin

class OrderItemCreate(BaseModel):
    material_id: UUID
    quantity_m3: Decimal
    

class OrderItemResponse(BaseModel):
    id: UUID
    material_id: UUID
    quantity_m3: Decimal
    unit_price: Decimal
    subtotal: Decimal

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    company_id: Optional[UUID]
    items: List[OrderItemCreate]


class OrderResponse(AuditResponseMixin):
    id: UUID
    company_id: UUID
    status: str
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True