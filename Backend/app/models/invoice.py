import uuid
from sqlalchemy import Column, String, Numeric, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.mixins import AuditMixin


class Invoice(Base, AuditMixin):
  __tablename__ = "invoices"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  # Una factura por pedido (el unique ya crea el índice)
  order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), unique=True, nullable=False)
  status = Column(String, nullable=False, default="pending")  # pending | issued

  # Copia de los valores del pedido al confirmar el pago
  subtotal = Column(Numeric(12, 2), nullable=False)
  tax = Column(Numeric(12, 2), nullable=False)
  total = Column(Numeric(12, 2), nullable=False)

  # Los llena quien carga la factura oficial
  invoice_number = Column(String, unique=True, nullable=True)  # ej. FHDA578
  cufe = Column(String, nullable=True)
  issued_at = Column(DateTime(timezone=True), nullable=True)
  signed_at = Column(DateTime(timezone=True), nullable=True)
  signature = Column(String, nullable=True)
  provider = Column(String, nullable=True)
  pdf_url = Column(String, nullable=True)
  xml_url = Column(String, nullable=True)
