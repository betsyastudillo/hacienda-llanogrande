from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class AuditResponseMixin(BaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    updated_by_user_id: Optional[UUID] = None
    deleted_by_user_id: Optional[UUID] = None