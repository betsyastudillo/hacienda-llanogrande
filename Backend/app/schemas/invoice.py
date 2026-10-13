from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.schemas.mixins import AuditResponseMixin


class InvoiceResponse(AuditResponseMixin):
  id: UUID
  order_id: UUID
  status: str
  subtotal: Decimal
  tax: Decimal
  total: Decimal
  invoice_number: Optional[str] = None
  cufe: Optional[str] = None
  issued_at: Optional[datetime] = None
  signed_at: Optional[datetime] = None
  signature: Optional[str] = None
  provider: Optional[str] = None
  pdf_url: Optional[str] = None
  xml_url: Optional[str] = None

  class Config:
    from_attributes = True