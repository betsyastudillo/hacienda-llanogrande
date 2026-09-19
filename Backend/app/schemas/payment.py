from pydantic import BaseModel
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


class PaymentResponse(AuditResponseMixin):
    id: UUID
    order_id: UUID
    bank_account_id: UUID
    proforma_number: str
    status: str
    amount: Decimal
    pdf_url: Optional[str] = None
    confirmed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

