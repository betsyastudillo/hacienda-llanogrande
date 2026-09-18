from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal
from app.schemas.mixins import AuditResponseMixin

class PaymentInitiateRequest(BaseModel):
    order_id: UUID

class PaymentResponse(BaseModel, AuditResponseMixin):
    id: UUID
    order_id: UUID
    bank_reference: str
    status: str
    amount: Decimal
    confirmed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WebhookRequest(BaseModel):
    bank_reference: str
    status: Literal["confirmed", "failed"]