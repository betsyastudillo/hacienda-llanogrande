from pydantic import BaseModel, Field
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Literal
from app.schemas.mixins import AuditResponseMixin
from app.schemas.vehicle import VehicleResponse
from app.schemas.carrier import CarrierResponse
from app.schemas.document import DocumentBase
from app.schemas.dispatch_guide import DispatchGuideResponse


class VehicleSubmission(BaseModel):
  plate: str
  type: str
  owner_name: str
  owner_document_type: str
  owner_document_id: str
  owner_phone: Optional[str] = None


class CarrierSubmission(BaseModel):
  full_name: str
  document_type: str
  document_id: str
  phone: str
  address: str


class TransportCheckInput(BaseModel):
  subject: Literal["vehicle", "owner", "carrier"]
  check_key: str
  has_findings: bool
  note: Optional[str] = None
  subject_ref: str


class TransportCheckResponse(BaseModel):
  subject: str
  check_key: str
  has_findings: bool
  note: Optional[str] = None
  subject_ref: Optional[str]

  class Config:
    from_attributes = True


class AssignmentItemInput(BaseModel):
  order_item_id: UUID
  quantity: int = Field(gt=0)


class AssignmentItemResponse(BaseModel):
  id: UUID
  order_item_id: UUID
  quantity: int

  class Config:
    from_attributes = True


class AssignmentCancel(BaseModel):
  reason: str


class AssignmentCreate(BaseModel):
  order_id: UUID
  items: List[AssignmentItemInput]  
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
  blacklist_vehicle: bool = False
  blacklist_owner: bool = False
  checks: List[TransportCheckInput] = []


class DocumentReview(BaseModel):
  status: Literal["approved", "rejected"]
  reason: Optional[str] = None

  
class OwnerLookupResponse(BaseModel):
  status: Literal["found", "not_found", "blocked"]
  owner_name: Optional[str] = None
  owner_phone: Optional[str] = None


class VehicleLookupResponse(BaseModel):
  status: Literal["found", "not_found", "blocked"]
  subject: Optional[Literal["vehicle", "owner"]] = None   # qué está vetado
  vehicle: Optional[VehicleResponse] = None


class CarrierLookupResponse(BaseModel):
  status: Literal["found", "not_found", "blocked"]
  carrier: Optional[CarrierResponse] = None


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
  review_pending: bool = False
  sequence: int = 1
  cancelled_at: Optional[datetime] = None
  cancellation_reason: Optional[str] = None
  items: List[AssignmentItemResponse] = []
  dispatch_guide: Optional[DispatchGuideResponse] = None   # lo adjunta attach_transport_details
  
  # No son columnas: el servicio los adjunta (attach_transport_details). El cliente no tiene
  # vehicle:ver ni carrier:ver, por eso van dentro de la respuesta de la asignación.
  vehicle: Optional[VehicleResponse] = None
  carrier: Optional[CarrierResponse] = None
  documents: List[DocumentBase] = []
  # Documentos obligatorios que faltan o fueron rechazados, p. ej. "vehicle:soat"
  missing_documents: List[str] = []
  blocked: List[str] = []   # subconjunto de "vehicle", "owner", "carrier"
  checks: List[TransportCheckResponse] = []
  required_checks: List[str] = []   # "vehicle:simit", "carrier:listas_vinculantes"...

  class Config:
    from_attributes = True


class AssignmentCorrection(BaseModel):
  vehicle: VehicleSubmission
  carrier: CarrierSubmission   # usa el nombre real de tu schema del transportador
  reason: Optional[str] = None


class PostReviewBody(BaseModel):
  checks: list[TransportCheckInput]   # el mismo schema de consultas que usa validate
  blacklist_carrier: bool = False
  blacklist_vehicle: bool = False
  blacklist_owner: bool = False
  reason: Optional[str] = None