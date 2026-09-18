from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.schemas.mixins import AuditResponseMixin

class AssignmentCreate(BaseModel):
    order_id: UUID
    vehicle_id: UUID
    carrier_id: UUID

class AssignmentResponse(AuditResponseMixin):
    id: UUID
    order_id: UUID
    vehicle_id: UUID
    carrier_id: UUID
    assigned_at: datetime

    class Config:
        from_attributes = True