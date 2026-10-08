from pydantic import BaseModel, model_validator
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal
from app.schemas.mixins import AuditResponseMixin

class PaymentInitiateRequest(BaseModel):
  order_id: UUID


class PaymentCreate(BaseModel):
  order_id: UUID
  bank_account_id: UUID


class PaymentConfirmRequest(BaseModel):
  status: Literal["confirmed", "failed"]
  reason: Optional[str] = None

  # reason es opcional pero se vuelve obligatorio si status es failes, entonces se valida después de que los campos se validaron
  @model_validator(mode="after")
  def reason_required_when_failed(self):
    if self.status == "failed" and not (self.reason and self.reason.strip()):
      raise ValueError("A reason is required when rejecting a payment")
    
    return self


class PaymentResponse(AuditResponseMixin):
  id: UUID
  order_id: UUID
  bank_account_id: UUID
  proforma_number: str
  status: str
  amount: Decimal
  pdf_url: Optional[str] = None
  confirmed_at: Optional[datetime] = None
  receipt_url: Optional[str] = None
  receipt_uploaded_at: Optional[datetime] = None
  rejection_reason: Optional[str] = None

  class Config:
    from_attributes = True

