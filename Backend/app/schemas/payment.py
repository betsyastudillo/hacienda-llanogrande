from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal

class PaymentInitiateRequest(BaseModel):
    order_id: UUID

class PaymentResponse(BaseModel):
    id: UUID
    order_id: UUID
    bank_reference: str
    status: str
    amount: Decimal
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None
    class Config:
        from_attributes = True

class WebhookRequest(BaseModel):
    bank_reference: str
    status: Literal["confirmed", "failed"]