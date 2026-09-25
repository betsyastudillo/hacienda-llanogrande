from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from app.schemas.mixins import AuditResponseMixin

class ProductBase(BaseModel):
    name: str
    category: str
    price: Decimal # Decimal no Float para que coincida con el Numeric
    tax_rate: Decimal = Decimal("0.19") # Decimal no Float para que coincida con el Numeric
    unit: str = "kg"  # kg, tonelada, unidad, canasta, bulto
    approx_weight_kg: Optional[Decimal] = None 
    parent_product_id: Optional[UUID] = None
    units_per_pack: Optional[Decimal] = None


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase, AuditResponseMixin):
    id: UUID
    is_active: bool

    class Config:
        from_attributes = True