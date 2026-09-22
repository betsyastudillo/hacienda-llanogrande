from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal
from app.schemas.mixins import AuditResponseMixin


class VehicleSubmission(BaseModel):
    type: str
    capacity_m3: Decimal
    plate: str


class CarrierSubmission(BaseModel):
    full_name: str
    document_type: str
    document_id: str
    phone: str
    address: str


class AssignmentCreate(BaseModel):
    order_id: UUID
    vehicle: VehicleSubmission
    carrier: CarrierSubmission


class AssignmentResubmit(BaseModel):
    vehicle: VehicleSubmission
    carrier: CarrierSubmission


class AssignmentValidateRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    rejection_reason: Optional[str] = None
    background_check_verified: bool = False
    blacklist_carrier: bool = False


class AssignmentResponse(AuditResponseMixin):
    id: UUID
    order_id: UUID
    vehicle_id: UUID
    carrier_id: UUID
    assigned_at: datetime
    validation_status: str
    rejection_reason: Optional[str] = None
    background_check_verified: bool
    validated_at: Optional[datetime] = None
    validated_by_user_id: Optional[UUID] = None

    class Config:
        from_attributes = True