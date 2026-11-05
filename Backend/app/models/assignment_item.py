import uuid
from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.mixins import AuditMixin


# Cantidad de cada producto del pedido que se lleva un retiro
class AssignmentItem(Base, AuditMixin):
  __tablename__ = "assignment_items"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False, index=True)
  order_item_id = Column(UUID(as_uuid=True), ForeignKey("order_items.id"), nullable=False)
  quantity = Column(Integer, nullable=False)

  assignment = relationship("Assignment", back_populates="items")
  order_item = relationship("OrderItem")

  __table_args__ = (
    UniqueConstraint("assignment_id", "order_item_id", name="uq_assignment_items_assignment_order_item"),
    CheckConstraint("quantity > 0", name="ck_assignment_items_quantity_positive"),
  )