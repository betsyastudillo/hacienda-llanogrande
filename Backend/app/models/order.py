from sqlalchemy import Column, String, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Order(Base, AuditMixin):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String, nullable=False, unique=True, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="created")
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    tax = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)


    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    company = relationship("Company")

    __table_args__ = (
    Index("ix_orders_created_by_user_id", "created_by_user_id"),
    Index("ix_orders_created_at", "created_at"),
)