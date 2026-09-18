from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Payment(Base, AuditMixin):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), unique=True, nullable=False) #unique=True porque un pedido solo debe tener un pago asociado.
    bank_reference = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, confirmed, failed
    amount = Column(Numeric(12, 2), nullable=False)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)