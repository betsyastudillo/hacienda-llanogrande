from pydantic import BaseModel, computed_field, ConfigDict, Field
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Any
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
    company_id: Optional[UUID] = None
    items: List[OrderItemCreate]


class OrderResponse(AuditResponseMixin):
    id: UUID
    company_id: UUID
    status: str
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    items: List[OrderItemResponse]

    # Se declara el objeto para que computed_field lo pueda leer
    company: Any  = Field(default=None, exclude=True)  # solo uso interno, nunca se serializa directo

    # Le dice a Pydantic que el campo no viene directo de una columna, sino que se calcula dinámicamente cada vez que se renderiza la respuesta
    @computed_field
    @property
    def company_legal_name(self) -> Optional[str]:
        return self.company.legal_name if self.company else None

    class Config:
        from_attributes = True