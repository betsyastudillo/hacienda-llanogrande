import os
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.constants.transport_requirements import (
  EDITABLE_ASSIGNMENT_STATUSES,
  PLATE_BLACKLIST_TYPE,
  REQUIRED_DOCUMENTS_BY_SUBJECT,
  TRANSPORT_ALLOWED_EXTENSIONS,
  TRANSPORT_MAX_FILE_SIZE,
  VALID_CARRIER_DOCUMENT_TYPES,
  compute_missing_documents,
  normalize_plate,
)
from app.models.assignment import Assignment
from app.models.carrier import Carrier
from app.models.document import Document
from app.models.document_blacklist import DocumentBlacklist
from app.models.order import Order
from app.models.vehicle import Vehicle
from app.services.document_blacklist_service import is_document_blacklisted
from app.services.document_service import create_document, replace_document_file
from app.services.order_service import can_access_order


# Adjunta a cada asignación su vehículo, transportador, documentos y los documentos que faltan.
# Son atributos temporales (no columnas), igual que needs_action en los pedidos.
def attach_transport_details(db: Session, assignments: List[Assignment]) -> List[Assignment]:
  if not assignments:
    return assignments

  vehicle_ids = {a.vehicle_id for a in assignments}
  carrier_ids = {a.carrier_id for a in assignments}

  vehicles = {v.id: v for v in db.query(Vehicle).filter(Vehicle.id.in_(vehicle_ids)).all()}
  carriers = {c.id: c for c in db.query(Carrier).filter(Carrier.id.in_(carrier_ids)).all()}
  documents = (
    db.query(Document)
    .filter(or_(Document.vehicle_id.in_(vehicle_ids), Document.carrier_id.in_(carrier_ids)))
    .order_by(Document.created_at)
    .all()
  )

  for a in assignments:
    a.vehicle = vehicles.get(a.vehicle_id)
    a.carrier = carriers.get(a.carrier_id)
    a.documents = [
      d for d in documents
      if d.vehicle_id == a.vehicle_id or d.carrier_id == a.carrier_id
    ]
    a.missing_documents = compute_missing_documents(a.vehicle_id, a.carrier_id, a.documents)

  return assignments


# Lista las asignaciones.
def get_assignments(db: Session) -> List[Assignment]:
  return attach_transport_details(db, db.query(Assignment).all())


# Trae una asignación por id de orden (sin detalles; para validaciones internas)
def get_assignment_by_order(db: Session, order_id: UUID) -> Optional[Assignment]:
  return db.query(Assignment).filter(Assignment.order_id == order_id).first()


# Trae una asignación por id de orden, con vehículo, transportador y documentos
def get_assignment_detail_by_order(db: Session, order_id: UUID) -> Optional[Assignment]:
  assignment = get_assignment_by_order(db, order_id)

  if not assignment:
    return None

  return attach_transport_details(db, [assignment])[0]


# Rechaza de entrada un vehículo o transportador vetado. No se incluye el motivo del veto:
# es información interna que el cliente no debe ver.
def _ensure_not_blacklisted(db: Session, vehicle_data, carrier_data) -> None:
  if is_document_blacklisted(db, PLATE_BLACKLIST_TYPE, normalize_plate(vehicle_data.plate)):
    raise ValueError("This vehicle is not authorized to enter the plant")

  if is_document_blacklisted(db, carrier_data.document_type, carrier_data.document_id.strip()):
    raise ValueError("This carrier is not authorized to enter the plant")


def _validate_submission(vehicle_data, carrier_data) -> None:
  if not normalize_plate(vehicle_data.plate):
    raise ValueError("The vehicle plate is required")

  if vehicle_data.capacity_m3 <= 0:
    raise ValueError("The vehicle capacity must be greater than zero")

  if carrier_data.document_type not in VALID_CARRIER_DOCUMENT_TYPES:
    raise ValueError(f"Carrier document type must be one of: {', '.join(VALID_CARRIER_DOCUMENT_TYPES)}")

  if not carrier_data.document_id.strip() or not carrier_data.full_name.strip():
    raise ValueError("The carrier name and document number are required")


# Busca o crea un vehículo (global: se reutiliza entre pedidos por placa)
def _find_or_create_vehicle(db: Session, data, current_user) -> Vehicle:
  plate = normalize_plate(data.plate)
  vehicle = db.query(Vehicle).filter(Vehicle.plate == plate).first()

  if vehicle:
    if not vehicle.is_active:
      raise ValueError("This vehicle is inactive and cannot be used")
    return vehicle

  new_vehicle = Vehicle(
    type=data.type, 
    capacity_m3=data.capacity_m3, 
    plate=plate,
    created_by_user_id=current_user.id,
  )

  db.add(new_vehicle)
  db.flush()  # asigna el id sin cerrar la transacción todavía

  return new_vehicle


# Busca o crea un transportador (global: se reutiliza entre pedidos por tipo y número de documento).
def _find_or_create_carrier(db: Session, data, current_user) -> Carrier:
  document_id = data.document_id.strip()

  carrier = (
    db.query(Carrier)
    .filter(Carrier.document_type == data.document_type, Carrier.document_id == document_id)
    .first()
  )

  if carrier:
    if not carrier.is_active:
      raise ValueError("This carrier is inactive and cannot be used")
    return carrier

  new_carrier = Carrier(
    full_name=data.full_name.strip(),
    document_type=data.document_type,
    document_id=document_id,
    phone=data.phone,
    address=data.address,
    created_by_user_id=current_user.id
  )

  db.add(new_carrier)
  db.flush()

  return new_carrier


# Se crea la asignación
def create_assignment(db: Session, data, current_user) -> Assignment:
  order = db.query(Order).filter(Order.id == data.order_id).first()

  if not order:
    raise ValueError("Order not found")

  if not can_access_order(order, current_user):
    raise ValueError("Order not found")

  if order.status != "facturado":
    raise ValueError(
      f"Transport can only be submitted when the order status is 'facturado' (current: {order.status})"
    )

  existing = get_assignment_by_order(db, data.order_id)

  if existing:
    raise ValueError(
      "This order already has a transport submission. "
      "If it was rejected, use the resubmit endpoint instead."
    )

  _validate_submission(data.vehicle, data.carrier)
  _ensure_not_blacklisted(db, data.vehicle, data.carrier)

  vehicle = _find_or_create_vehicle(db, data.vehicle, current_user)
  carrier = _find_or_create_carrier(db, data.carrier, current_user)

  new_assignment = Assignment(
    order_id=data.order_id,
    vehicle_id=vehicle.id,
    carrier_id=carrier.id,
    validation_status="pending",
    created_by_user_id = current_user.id,
  )

  db.add(new_assignment)
  db.commit()
  db.refresh(new_assignment)

  return attach_transport_details(db, [new_assignment])[0]


# Si se rechaza el vehículo o transportador, el cliente corrige y reenvía SOBRE LA MISMA asignación
# (vuelve a pending y se limpia el motivo), igual que el comprobante del pago.
def resubmit_assignment(db: Session, order_id: UUID, vehicle_data, carrier_data, current_user) -> Assignment:
  order = db.query(Order).filter(Order.id == order_id).first()

  if not order:
    raise ValueError("Order not found")

  if not can_access_order(order, current_user):
    raise ValueError("Order not found")

  if order.status != "facturado":
    raise ValueError(
      f"Transport can only be resubmitted when the order status is 'facturado' (current: {order.status})"
    )

  assignment = get_assignment_by_order(db, order_id)

  if not assignment:
    raise ValueError("No transport submission found for this order")

  if assignment.validation_status != "rejected":
    raise ValueError("Only a rejected transport submission can be resubmitted")

  _validate_submission(vehicle_data, carrier_data)
  _ensure_not_blacklisted(db, vehicle_data, carrier_data)

  vehicle = _find_or_create_vehicle(db, vehicle_data, current_user)
  carrier = _find_or_create_carrier(db, carrier_data, current_user)

  assignment.vehicle_id = vehicle.id
  assignment.carrier_id = carrier.id
  assignment.validation_status = "pending"
  assignment.rejection_reason = None
  assignment.background_check_verified = False
  assignment.validated_at = None
  assignment.validated_by_user_id = None
  assignment.updated_by_user_id=current_user.id

  db.commit()
  db.refresh(assignment)

  return attach_transport_details(db, [assignment])[0]


# Valida extensión y tamaño del archivo antes de guardarlo (mismas reglas que el comprobante de pago)
def _validate_transport_file(file: UploadFile) -> None:
  extension = os.path.splitext(file.filename or "")[1].lower()

  if extension not in TRANSPORT_ALLOWED_EXTENSIONS:
    raise ValueError("The document must be a PDF, JPG, PNG or WEBP file")

  # Mide el tamaño sin cargar el archivo completo en memoria
  file.file.seek(0, os.SEEK_END)
  size = file.file.tell()
  file.file.seek(0)

  if size == 0:
    raise ValueError("The document file is empty")

  if size > TRANSPORT_MAX_FILE_SIZE:
    raise ValueError("The document file must be 5 MB or smaller")


# El cliente sube (o reemplaza) un documento del vehículo o del transportador de su asignación.
def upload_transport_document(
    db: Session,
    order_id: UUID,
    subject: str,
    document_type: str,
    file: UploadFile,
    current_user,
  ) -> Document:
  order = db.query(Order).filter(Order.id == order_id).first()

  if not order or not can_access_order(order, current_user):
    raise ValueError("Order not found")

  if order.status != "facturado":
    raise ValueError("Transport documents can only be uploaded while the order is 'facturado'")

  assignment = get_assignment_by_order(db, order_id)

  if not assignment:
    raise ValueError("Submit the transport information before uploading documents")

  if assignment.validation_status not in EDITABLE_ASSIGNMENT_STATUSES:
    raise ValueError(f"Cannot upload documents for a submission that is {assignment.validation_status}")

  if subject not in REQUIRED_DOCUMENTS_BY_SUBJECT:
    raise ValueError("subject must be 'vehicle' or 'carrier'")

  if document_type not in REQUIRED_DOCUMENTS_BY_SUBJECT[subject]:
    allowed = ", ".join(REQUIRED_DOCUMENTS_BY_SUBJECT[subject])
    raise ValueError(f"Document type for {subject} must be one of: {allowed}")

  _validate_transport_file(file)

  owner_column = Document.vehicle_id if subject == "vehicle" else Document.carrier_id
  owner_id = assignment.vehicle_id if subject == "vehicle" else assignment.carrier_id

  existing = (
    db.query(Document)
    .filter(owner_column == owner_id, Document.document_type == document_type)
    .order_by(Document.created_at.desc())
    .first()
  )

  if existing:
    return replace_document_file(db, existing.id, file, current_user=current_user)

  if subject == "vehicle":
    return create_document(db, document_type, file, vehicle_id=owner_id, current_user=current_user)

  return create_document(db, document_type, file, carrier_id=owner_id, current_user=current_user)


# Ruta del archivo de un documento de transporte, solo si pertenece al vehículo o transportador del pedido.
def get_transport_document(db: Session, order_id: UUID, document_id: UUID) -> Document:
  assignment = get_assignment_by_order(db, order_id)

  if not assignment:
    raise ValueError("Assignment not found for this order")

  document = (
    db.query(Document)
    .filter(
      Document.id == document_id,
      or_(Document.vehicle_id == assignment.vehicle_id, Document.carrier_id == assignment.carrier_id),
    )
    .first()
  )

  if not document:
    raise ValueError("Document not found")

  return document


# Validación de la asignación
def validate_assignment(
    db: Session,
    assignment_id: UUID,
    decision: str,
    rejection_reason: Optional[str],
    background_check_verified: bool,
    blacklist_carrier: bool,
    current_user
  ) -> Assignment:
  assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()

  if not assignment:
    raise ValueError("Assignment not found")

  if assignment.validation_status != "pending":
    raise ValueError(f"This submission was already {assignment.validation_status}")

  if decision == "rejected" and not rejection_reason:
    raise ValueError("rejection_reason is required when rejecting")

  order = db.query(Order).filter(Order.id == assignment.order_id).first()

  if decision == "approved":
    if not background_check_verified:
      raise ValueError("Must confirm background_check_verified before approving")

    if order.status != "facturado":
      raise ValueError(f"The order must be 'facturado' to approve its transport (current: {order.status})")

    documents = (
      db.query(Document)
      .filter(or_(Document.vehicle_id == assignment.vehicle_id, Document.carrier_id == assignment.carrier_id))
      .all()
    )
    missing = compute_missing_documents(assignment.vehicle_id, assignment.carrier_id, documents)

    if missing:
      raise ValueError(f"Cannot approve: missing required documents: {', '.join(missing)}")

    # Logística no tiene document:revisar, así que su aprobación cubre los documentos obligatorios
    for doc in documents:
      required = REQUIRED_DOCUMENTS_BY_SUBJECT["vehicle" if doc.vehicle_id else "carrier"]
      if doc.document_type in required and doc.status != "approved":
        doc.status = "approved"
        doc.updated_by_user_id = current_user.id

  assignment.validation_status = decision
  assignment.rejection_reason = rejection_reason if decision == "rejected" else None
  assignment.background_check_verified = background_check_verified if decision == "approved" else False
  assignment.validated_at = datetime.now(timezone.utc)
  assignment.validated_by_user_id = current_user.id
  assignment.updated_by_user_id = current_user.id

  if decision == "approved":
    order.status = "transport_validated"
    order.updated_by_user_id = current_user.id

  if decision == "rejected" and blacklist_carrier:
    carrier = db.query(Carrier).filter(Carrier.id == assignment.carrier_id).first()
    existing_ban = is_document_blacklisted(db, carrier.document_type, carrier.document_id)

    if not existing_ban:
      ban = DocumentBlacklist(
        document_type=carrier.document_type,
        document_number=carrier.document_id,
        reason=rejection_reason or "Rechazado en validación de transporte",
        created_by_user_id=current_user.id
      )

      db.add(ban)
    carrier.is_active = False
    carrier.updated_by_user_id = current_user.id
    
  db.commit()
  db.refresh(assignment)

  return attach_transport_details(db, [assignment])[0]
