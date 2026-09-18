from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal

class MaterialBase(BaseModel):
    name: str
    description: Optional[str]
    category: str
    price: Decimal # Decimal no Float para que coincida con el Numeric
    tax_rate: Decimal = Decimal("0.19") # Decimal no Float para que coincida con el Numeric


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(MaterialBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None
    class Config:
        from_attributes = True