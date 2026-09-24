from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from typing import Optional, Literal
from app.schemas.mixins import AuditResponseMixin


class InventoryMovementCreate(BaseModel):
    material_id: UUID
    movement_type: Literal["entrada", "ajuste"]  # "salida" solo la genera el sistema al crear un pedido
    quantity: Decimal
    reason: Optional[str] = None


class InventoryMovementResponse(AuditResponseMixin):
    id: UUID
    material_id: UUID
    order_id: Optional[UUID] = None
    movement_type: str
    quantity: Decimal
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class StockResponse(BaseModel):
    material_id: UUID
    current_stock: Decimal