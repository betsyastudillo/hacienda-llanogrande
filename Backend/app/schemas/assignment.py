from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class AssignmentCreate(BaseModel):
    order_id: UUID
    vehicle_id: UUID
    carrier_id: UUID

class AssignmentResponse(BaseModel):
    id: UUID
    order_id: UUID
    vehicle_id: UUID
    carrier_id: UUID
    assigned_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None
    class Config:
        from_attributes = True