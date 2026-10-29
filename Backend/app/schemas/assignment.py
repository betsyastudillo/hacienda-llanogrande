from pydantic import BaseModel
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Literal
from app.schemas.mixins import AuditResponseMixin
from app.schemas.vehicle import VehicleResponse
from app.schemas.carrier import CarrierResponse
from app.schemas.document import DocumentBase


class VehicleSubmission(BaseModel):
  plate: str
  type: str
  capacity_m3: Decimal
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


class TransportCheckResponse(BaseModel):
  subject: str
  check_key: str
  has_findings: bool
  note: Optional[str] = None
  subject_ref: Optional[str]

  class Config:
    from_attributes = True

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