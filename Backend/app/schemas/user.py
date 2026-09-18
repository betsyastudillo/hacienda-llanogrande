from datetime import datetime
from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from app.schemas.mixins import AuditResponseMixin

class UserBase(BaseModel):
    document_id: str
    full_name: str
    email: str
    role: str
    company_id: UUID
    is_active: Optional[bool] = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel, AuditResponseMixin):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    company_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    
class UserResponse(UserBase):
    id: UUID
    is_active: bool

    deleted_by_user_id: Optional[UUID] = None
    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    document_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"