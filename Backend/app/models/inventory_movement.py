from sqlalchemy import Column, String, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class InventoryMovement(Base, AuditMixin):
    __tablename__ = "inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)  # si el movimiento vino de un pedido
    movement_type = Column(String, nullable=False)  # entrada | salida | ajuste
    quantity = Column(Integer, nullable=False)  # positivo en entrada/salida; puede ser +/- en ajuste
    reason = Column(String, nullable=True)