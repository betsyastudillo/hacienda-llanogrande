from sqlalchemy import Column, String, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class InventoryMovement(Base, AuditMixin):
    __tablename__ = "inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True, index=True)  # si el movimiento vino de un pedido
    movement_type = Column(String, nullable=False)  # entrada | salida | ajuste
    quantity = Column(Integer, nullable=False)  # positivo en entrada/salida; puede ser +/- en ajuste
    reason = Column(String, nullable=True)
    category = Column(String, nullable=True)  # solo en ajustes: damage | count_difference | other

    __table_args__ = (
      Index("ix_inventory_product_created", "product_id", "created_at"),
    )