from datetime import date
from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from typing import Optional, Literal
from app.schemas.mixins import AuditResponseMixin


class InventoryMovementCreate(BaseModel):
    product_id: UUID
    movement_type: Literal["entrada", "ajuste"]  # "salida" solo la genera el sistema al crear un pedido
    quantity: int
    reason: Optional[str] = None
    category: Optional[Literal["damage", "count_difference", "other"]] = None


class InventoryMovementResponse(AuditResponseMixin):
    id: UUID
    product_id: UUID
    order_id: Optional[UUID] = None
    movement_type: str
    quantity: int
    reason: Optional[str] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True


class StockResponse(BaseModel):
    product_id: UUID
    current_stock: int


class KardexResponse(BaseModel):
    product_id: UUID
    start_date: date
    end_date: date
    opening_balance: int
    entries: int
    exits: int                # salidas por venta
    adjustments_damage: int   # pérdidas por daño (negativo)
    adjustments_other: int    # otros ajustes (+/-)
    closing_balance: int