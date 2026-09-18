from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from app.schemas.mixins import AuditResponseMixin

class MaterialBase(BaseModel):
    name: str
    description: Optional[str]
    category: str
    price: Decimal # Decimal no Float para que coincida con el Numeric
    tax_rate: Decimal = Decimal("0.19") # Decimal no Float para que coincida con el Numeric


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(MaterialBase, AuditResponseMixin):
    id: UUID
    is_active: bool

    class Config:
        from_attributes = True