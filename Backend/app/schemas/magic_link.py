from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.schemas.mixins import AuditResponseMixin


class MagicLinkCreate(BaseModel):
    user_id: UUID


class MagicLinkResponse(AuditResponseMixin):
    id: UUID
    user_id: UUID
    token: str
    status: str
    expires_at: datetime

    class Config:
        from_attributes = True


class MagicLinkVerifyResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"