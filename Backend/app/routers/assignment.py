import mimetypes
import os
from typing import Literal, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.schemas.carrier import CarrierResponse
from app.schemas.vehicle import VehicleResponse
from app.services.order_service import can_access_order, get_order_by_id
from app.dependencies import user_has_permission
from app.auth_dependencies import (
  AssignmentLookup, AssignmentValidator, AssignmentViewer, AssignmentViewerAny,
  AssignmentCreatorOwn,
)
from app.schemas.assignment import (
  AssignmentCreate, AssignmentResubmit, AssignmentValidateRequest, AssignmentResponse, CarrierLookupResponse, OwnerLookupResponse, VehicleLookupResponse,
)
from app.schemas.document import DocumentBase
from app.services.assignment_service import (
  create_assignment, lookup_carrier, lookup_owner, lookup_vehicle, resubmit_assignment, validate_assignment,
  get_assignment_detail_by_order, get_assignments,
  upload_transport_document, get_transport_document,
)

router = APIRouter(prefix="/assignments", tags=["Assignments"])


# Un pedido ajeno responde 404 y no 400, para no revelar que existe (regla del CLAUDE.md)
def _error_status(error: ValueError) -> int:
  return 404 if str(error) == "Order not found" else 400


@router.get("/lookup/owner", response_model=OwnerLookupResponse, summary="Busca al dueño de un vehículo por documento (ayuda del formulario)")
def lookup_owner_endpoint(document_type: str, document_id: str, current_user: AssignmentLookup, db: Session = Depends(get_db)):
  return lookup_owner(db, document_type, document_id, current_user)


@router.get("/lookup/vehicle", response_model=VehicleLookupResponse, summary="Busca un vehículo por placa (ayuda del formulario)")
def lookup_vehicle_endpoint(plate: str, current_user: AssignmentLookup, db: Session = Depends(get_db)):
  return lookup_vehicle(db, plate, current_user)


@router.get("/lookup/carrier", response_model=CarrierLookupResponse, summary="Busca un transportador por documento (ayuda del formulario)")
def lookup_carrier_endpoint(document_type: str, document_id: str, current_user: AssignmentLookup, db: Session = Depends(get_db)):
  return lookup_carrier(db, document_type, document_id, current_user)


@router.get("/", response_model=list[AssignmentResponse], summary="Lista todas las asignaciones.")
def get_list_assignments(
  current_user: AssignmentViewer,
  db: Session = Depends(get_db),
):
  return get_assignments(db)


@router.get("/order/{order_id}", response_model=AssignmentResponse, summary="Trae una asignación por id de la orden")
def get_assignment_by_order_id(
  order_id: UUID,
  current_user: AssignmentViewerAny,
  db: Session = Depends(get_db),
):
  order = get_order_by_id(db, order_id)
  
  if not order:
    raise HTTPException(status_code=404, detail="Order not found")

  # Si no tiene permiso:
  if not user_has_permission(current_user, "assignment:ver") and not can_access_order(order, current_user):
    raise HTTPException(status_code=404, detail="Order not found")

  assignment = get_assignment_detail_by_order(db, order_id)

  if not assignment:
    raise HTTPException(status_code=404, detail="Assignment not found for this order")

  return assignment


@router.post("/", response_model=AssignmentResponse, summary="Registra una asignación")
def register_assignment(
  data: AssignmentCreate,
  current_user: AssignmentCreatorOwn,
  db: Session = Depends(get_db),
):
  try:
    return create_assignment(db, data, current_user)

  except ValueError as e:
    db.rollback()
    raise HTTPException(status_code=_error_status(e), detail=str(e))


@router.post("/order/{order_id}/documents", response_model=DocumentBase, summary="El cliente sube o reemplaza un documento del vehículo o del transportador.")
def upload_document(
  order_id: UUID,
  current_user: AssignmentCreatorOwn,
  subject: Literal["vehicle", "carrier"] = Form(...),
  document_type: str = Form(...),
  file: UploadFile = File(...),
  db: Session = Depends(get_db),
):
  try:
    return upload_transport_document(db, order_id, subject, document_type, file, current_user)

  except ValueError as e:
    db.rollback()
    raise HTTPException(status_code=_error_status(e), detail=str(e))


@router.get("/order/{order_id}/documents/{document_id}/file", summary="Descarga un documento de transporte (exige sesión y acceso al pedido).")
def download_document(
  order_id: UUID,
  document_id: UUID,
  current_user: AssignmentViewerAny,
  db: Session = Depends(get_db),
):
  order = get_order_by_id(db, order_id)

  if not order:
    raise HTTPException(status_code=404, detail="Order not found")

  if not user_has_permission(current_user, "assignment:ver") and not can_access_order(order, current_user):
    raise HTTPException(status_code=404, detail="Order not found")

  try:
    document = get_transport_document(db, order_id, document_id)

  except ValueError as e:
    raise HTTPException(status_code=404, detail=str(e))

  path = document.document_url.lstrip("/")

  if not os.path.exists(path):
    raise HTTPException(status_code=404, detail="File not found")

  media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
  return FileResponse(path, media_type=media_type, filename=os.path.basename(path))


@router.put("/order/{order_id}/resubmit", response_model=AssignmentResponse, summary="Reenvío de información si se rechazó vehículo o transportador.")
def resubmit(
  order_id: UUID,
  data: AssignmentResubmit,
  current_user: AssignmentCreatorOwn,
  db: Session = Depends(get_db),
):
  try:
    return resubmit_assignment(db, order_id, data.vehicle, data.carrier, current_user)

  except ValueError as e:
    db.rollback()
    raise HTTPException(status_code=_error_status(e), detail=str(e))


@router.patch("/{assignment_id}/validate", response_model=AssignmentResponse, summary="Validación de la asignación")
def validate(
  assignment_id: UUID,
  data: AssignmentValidateRequest,
  current_user: AssignmentValidator,
  db: Session = Depends(get_db),
):
  try:
    return validate_assignment(
      db, assignment_id, data.decision, data.rejection_reason,
      data.background_check_verified, data.blacklist_carrier, current_user,
    )

  except ValueError as e:
    db.rollback()
    raise HTTPException(status_code=400, detail=str(e))