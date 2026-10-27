import os, re
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.constants.transport_requirements import (
  ALLOWED_DOCUMENTS_BY_SUBJECT,
  BLOCKING_TRANSPORT_CHECKS,
  EDITABLE_ASSIGNMENT_STATUSES,
  OWNER_DOCUMENT,
  PLATE_BLACKLIST_TYPE,
  REQUIRED_DOCUMENTS_BY_SUBJECT,
  TRANSPORT_ALLOWED_EXTENSIONS,
  TRANSPORT_MAX_FILE_SIZE,
  VALID_CARRIER_DOCUMENT_TYPES,
  VALID_OWNER_DOCUMENT_TYPES,
  VALID_VEHICLE_TYPES,
  compute_missing_documents,
  normalize_plate,
  required_document_keys,
  required_transport_checks,
)
from app.dependencies import user_has_permission
from app.models.assignment import Assignment
from app.models.carrier import Carrier
from app.models.company import Company
from app.models.document import Document
from app.models.document_blacklist import DocumentBlacklist
from app.models.order import Order
from app.models.transport_check import TransportCheck
from app.models.vehicle import Vehicle
from app.services.document_blacklist_service import is_document_blacklisted
from app.services.document_service import create_document, replace_document_file
from app.services.order_service import can_access_order, CLIENT_ROLES


PHONE_RE = re.compile(r"\d{7,15}")
PLATE_RE = re.compile(r"[A-Z0-9]{5,6}")

def is_owner_carrier(vehicle, carrier) -> bool:
  return bool(
    vehicle and carrier and vehicle.owner_document_id
    and vehicle.owner_document_id == carrier.document_id
    and vehicle.owner_document_type == carrier.document_type
  )


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

  # Documentos vetados entre todos los envíos, en una sola consulta
  numbers = set()
  
  for v in vehicles.values():
    numbers.add(v.plate)
    if v.owner_document_id:
      numbers.add(v.owner_document_id)
  
  for c in carriers.values():
    numbers.add(c.document_id)

  listed = set()
  
  if numbers:
    rows = (
      db.query(DocumentBlacklist.document_type, DocumentBlacklist.document_number)
      .filter(DocumentBlacklist.is_active == True, DocumentBlacklist.document_number.in_(numbers))  # noqa: E712
      .all()
    )
    listed = {(r[0], r[1]) for r in rows}

  all_checks = (
    db.query(TransportCheck)
    .filter(TransportCheck.assignment_id.in_([a.id for a in assignments]))
    .all()
  )

  for a in assignments:
    # Primero se asignan los atributos...
    a.vehicle = vehicles.get(a.vehicle_id)
    a.carrier = carriers.get(a.carrier_id)
    a.documents = [
      d for d in documents
      if d.vehicle_id == a.vehicle_id or d.carrier_id == a.carrier_id
    ]
    a.missing_documents = compute_missing_documents(
      a.vehicle_id, a.carrier_id, a.documents, is_owner_carrier(a.vehicle, a.carrier)
    )
    
    # Después de calcula lo vetado, que los usa
    v, c = a.vehicle, a.carrier
    a.blocked = []
    
    a.checks = [ch for ch in all_checks if ch.assignment_id == a.id]
    a.required_checks = [
      f"{s}:{k}" for s, k in required_transport_checks(is_owner_carrier(a.vehicle, a.carrier))
    ]

    if v and (PLATE_BLACKLIST_TYPE, v.plate) in listed:
      a.blocked.append("vehicle")
    if v and v.owner_document_id and (v.owner_document_type, v.owner_document_id) in listed:
      a.blocked.append("owner")
    if c and (c.document_type, c.document_id) in listed:
      a.blocked.append("carrier")

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
    raise ValueError("Este vehículo no está autorizado para ingresar a la planta. Si tienes dudas, comunícate con el área de Logística.")

  if is_document_blacklisted(db, carrier_data.document_type, carrier_data.document_id.strip()):
    raise ValueError("Este transportador no está autorizado para ingresar a la planta. Si tienes dudas, comunícate con el área de Logística.")

  if is_document_blacklisted(db, vehicle_data.owner_document_type, vehicle_data.owner_document_id.strip()):
    raise ValueError("El propietario del vehículo no está autorizado para ingresar a la planta. Si tienes dudas, comunícate con Logística.")


def _validate_submission(vehicle_data, carrier_data) -> None:
  
  if not PLATE_RE.fullmatch(normalize_plate(vehicle_data.plate)):
    raise ValueError("La placa debe tener 5 o 6 letras y números.")

  if not normalize_plate(vehicle_data.plate):
    raise ValueError("La placa del vehículo es obligatoria.")

  if vehicle_data.type not in VALID_VEHICLE_TYPES:
    raise ValueError(f"El tipo de vehículo debería ser uno de: {', '.join(VALID_VEHICLE_TYPES)}")

  if vehicle_data.capacity_m3 <= 0:
    raise ValueError("La capacidad del vehículo debe ser mayor a 0.")

  if not vehicle_data.owner_name.strip() or not vehicle_data.owner_document_id.strip():
    raise ValueError("El nombre y número de documento del propietario del vehículo son obligatorios.")

  if vehicle_data.owner_document_type not in VALID_OWNER_DOCUMENT_TYPES:
    raise ValueError(f"El tipo de documento del propietario debería ser uno de: {', '.join(VALID_OWNER_DOCUMENT_TYPES)}")

  if carrier_data.document_type not in VALID_CARRIER_DOCUMENT_TYPES:
    raise ValueError(f"El tipo de documento del transportador debería ser uno de: {', '.join(VALID_CARRIER_DOCUMENT_TYPES)}")

  if not carrier_data.document_id.strip() or not carrier_data.full_name.strip():
    raise ValueError("El nombre y documento del transportador son obligatorios.")

  if not PHONE_RE.fullmatch((carrier_data.phone or "").strip()):
    raise ValueError("El teléfono del transportador debe tener entre 7 y 15 dígitos.")

  if not (carrier_data.address or "").strip():
    raise ValueError("La dirección del transportador es obligatoria.")


# Se reutiliza entre pedidos por placa)
def _find_or_create_vehicle(db: Session, data, current_user) -> Vehicle:
  
  plate = normalize_plate(data.plate)

  fields = {
    "type": data.type,
    "capacity_m3": data.capacity_m3,
    "owner_name": data.owner_name.strip(),
    "owner_document_type": data.owner_document_type,
    "owner_document_id": data.owner_document_id.strip(),
    "owner_phone": data.owner_phone,
  }

  vehicle = db.query(Vehicle).filter(Vehicle.plate == plate).first()

  if vehicle:
    if not vehicle.is_active:
      raise ValueError("Este vehículo está inactivo y no se puede usar.")
        
    owner_changed = (
      (vehicle.owner_document_type, vehicle.owner_document_id)
      != (fields["owner_document_type"], fields["owner_document_id"])
    )
      
    # Si la placa ya existía, se actualizan los datos que llegan (si hay cambios)
    if any(getattr(vehicle, k) != v for k, v in fields.items()):
      for k, v in fields.items():
        setattr(vehicle, k, v)
      
      vehicle.updated_by_user_id = current_user.id

      if owner_changed:
        # El documento del dueño anterior ya no sirve: se vuelve a pedir
        db.query(Document).filter(
          Document.vehicle_id == vehicle.id, Document.document_type == OWNER_DOCUMENT
        ).update({"status": "rejected"})
        
    return vehicle

  new_vehicle = Vehicle(plate=plate, created_by_user_id=current_user.id, **fields)

  db.add(new_vehicle)
  db.flush()  # asigna el id sin cerrar la transacción todavía

  return new_vehicle


# Se reutiliza entre pedidos por tipo y número de documento).
def _find_or_create_carrier(db: Session, data, current_user) -> Carrier:
  document_id = data.document_id.strip()
  fields = {
    "full_name": data.full_name.strip(), 
    "phone": data.phone.strip(), 
    "address": data.address.strip()
  }

  carrier = (
    db.query(Carrier)
    .filter(Carrier.document_type == data.document_type, Carrier.document_id == document_id)
    .first()
  )

  if carrier:
    if not carrier.is_active:
      raise ValueError("Este transportador está inactivo y no se puede usar.")
    
    if any(getattr(carrier, k) != v for k, v in fields.items()):
      for k, v in fields.items():
        setattr(carrier, k, v)
      carrier.updated_by_user_id = current_user.id

    return carrier

  new_carrier = Carrier(
    document_type=data.document_type, document_id=document_id,
    created_by_user_id=current_user.id, **fields,
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
      "Este pedido ya tiene un transporte enviado. Si fue rechazado, corrígelo y reenvíalo."
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

  # Quien revisa los documentos no los sube: así la revisión no puede sustituir lo que evalúa
  if user_has_permission(current_user, "assignment:validar"):
    raise ValueError("Quien valida el transporte no puede subir ni reemplazar sus documentos")
  
  assignment = get_assignment_by_order(db, order_id)

  if not assignment:
    raise ValueError("Submit the transport information before uploading documents")

  if assignment.validation_status not in EDITABLE_ASSIGNMENT_STATUSES:
    raise ValueError(f"Cannot upload documents for a submission that is {assignment.validation_status}")

  if subject not in ALLOWED_DOCUMENTS_BY_SUBJECT:
    raise ValueError("subject must be 'vehicle' or 'carrier'")

  if document_type not in ALLOWED_DOCUMENTS_BY_SUBJECT[subject]:
    allowed = ", ".join(ALLOWED_DOCUMENTS_BY_SUBJECT[subject])
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
  current_user,
  checks = None,
) -> Assignment:
  
  assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()

  if not assignment:
    raise ValueError("Assignment not found")

  if assignment.validation_status != "pending":
    raise ValueError(f"This submission was already {assignment.validation_status}")

  if decision not in ("approved", "rejected"):
    raise ValueError("rejection_reason is required when rejecting")

  rejection_reason = (rejection_reason or "").strip()

  if decision == "rejected" and not rejection_reason:
    raise ValueError("rejection_reason is required when rejecting")

  order = db.query(Order).filter(Order.id == assignment.order_id).first()
  
  if not order:
    raise ValueError("Order not found")
  
  if decision == "approved":
    # Todas las consultas deben estar registradas, y los hallazgos llevar descripción
    submitted = {(ch.subject, ch.check_key): ch for ch in (checks or [])}
    required = required_transport_checks(is_owner_carrier(detail.vehicle, detail.carrier))

    missing_checks = [f"{s}:{k}" for s, k in required if (s, k) not in submitted]
    
    if missing_checks:
      raise ValueError(f"Faltan consultas por registrar: {', '.join(missing_checks)}")

    for (s, k), ch in submitted.items():
    
      if (s, k) not in required:
        raise ValueError(f"Consulta no válida: {s}:{k}")
    
      if ch.has_findings and not (ch.note or "").strip():
        raise ValueError("Los hallazgos requieren una descripción")
    
      if ch.has_findings and k in BLOCKING_TRANSPORT_CHECKS:
        raise ValueError("Hay un hallazgo que impide aprobar este transporte")

    if order.status != "facturado":
      raise ValueError(f"The order must be 'facturado' to approve its transport (current: {order.status})")

    detail = attach_transport_details(db, [assignment])[0]

    if detail.blocked:
      raise ValueError("Cannot approve: the vehicle, its owner or the carrier is on the blacklist")

    if detail.missing_documents:
      raise ValueError(f"Cannot approve: missing required documents: {', '.join(detail.missing_documents)}")

    # Cada documento obligatorio debe haber sido aprobado por logística, uno por uno
    status_by_key = {
      f"{'vehicle' if d.vehicle_id else 'carrier'}:{d.document_type}": d.status
      for d in detail.documents
    }
    
    required = required_document_keys(is_owner_carrier(detail.vehicle, detail.carrier))
    not_approved = [k for k in required if status_by_key.get(k) != "approved"]

    if not_approved:
      raise ValueError(f"Cannot approve: these documents must be approved first: {', '.join(not_approved)}")

  assignment.validation_status = decision
  assignment.rejection_reason = rejection_reason if decision == "rejected" else None
  assignment.background_check_verified = decision == "approved"
  assignment.validated_at = datetime.now(timezone.utc)
  assignment.validated_by_user_id = current_user.id
  assignment.updated_by_user_id = current_user.id

  submitted = {} # Para que no dé error en la línea 557

  if decision == "approved":
    order.status = "transport_validated"
    order.updated_by_user_id = current_user.id

    db.query(TransportCheck).filter(TransportCheck.assignment_id == assignment.id).delete()
    for (s, k), ch in submitted.items():
      db.add(TransportCheck(
        assignment_id=assignment.id, subject=s, check_key=k,
        has_findings=ch.has_findings,
        note=(ch.note or "").strip() if ch.has_findings else None,
        created_by_user_id=current_user.id,
      ))

  if decision == "rejected" and blacklist_carrier:
    carrier = db.query(Carrier).filter(Carrier.id == assignment.carrier_id).first()
    existing_ban = is_document_blacklisted(db, carrier.document_type, carrier.document_id)

    if not existing_ban:
      db.add(DocumentBlacklist(
        document_type=carrier.document_type,
        document_number=carrier.document_id,
        reason=rejection_reason or "Rechazado en validación de transporte",
        created_by_user_id=current_user.id,
      ))

    carrier.is_active = False
    carrier.updated_by_user_id = current_user.id
    
  db.commit()
  db.refresh(assignment)

  return attach_transport_details(db, [assignment])[0]


def _used_by_company(db: Session, company_id, vehicle_id=None, carrier_id=None) -> bool:
  query = (
    db.query(Assignment.id)
    .join(Order, Order.id == Assignment.order_id)
    .filter(Order.company_id == company_id)
  )
  if vehicle_id:
    query = query.filter(Assignment.vehicle_id == vehicle_id)
  if carrier_id:
    query = query.filter(Assignment.carrier_id == carrier_id)
  return query.first() is not None


# Búsqueda de ayuda para el formulario. Devuelve None si no existe, está inactivo, está vetado, o (para clientes) no lo ha usado su empresa: así no revela datos ajenos.
def lookup_owner(db: Session, document_type: str, document_id: str, current_user) -> dict:
  
  document_id = (document_id or "").strip()
  
  if not document_id:
    return {"status": "not_found"}

  if is_document_blacklisted(db, document_type, document_id):
    return {"status": "blocked"}

  is_client = current_user.role in CLIENT_ROLES

  # 1. Empresas registradas con ese documento
  company_query = db.query(Company).filter(
    Company.document_type == document_type,
    Company.document_number == document_id,
    Company.is_active == True,  # noqa: E712
  )
  
  if is_client:
    company_query = company_query.filter(Company.id == current_user.company_id)

  company = company_query.first()
  
  if company:
    return {"status": "found", "owner_name": company.legal_name, "owner_phone": company.phone}

  # 2. Vehículos con ese dueño (a un cliente, solo los que usó su empresa)
  query = db.query(Vehicle).filter(
    Vehicle.owner_document_type == document_type, Vehicle.owner_document_id == document_id
  )
  
  if is_client:
    query = (
      query.join(Assignment, Assignment.vehicle_id == Vehicle.id)
      .join(Order, Order.id == Assignment.order_id)
      .filter(Order.company_id == current_user.company_id)
    )
  
  vehicle = query.order_by(Vehicle.created_at.desc()).first()
  
  if vehicle:
    return {"status": "found", "owner_name": vehicle.owner_name, "owner_phone": vehicle.owner_phone}

  # 3. Transportadores con ese documento
  query = db.query(Carrier).filter(Carrier.document_type == document_type, Carrier.document_id == document_id)
  
  if is_client:
    query = (
      query.join(Assignment, Assignment.carrier_id == Carrier.id)
      .join(Order, Order.id == Assignment.order_id)
      .filter(Order.company_id == current_user.company_id)
    )
  
  carrier = query.order_by(Carrier.created_at.desc()).first()
  
  if carrier:
    return {"status": "found", "owner_name": carrier.full_name, "owner_phone": carrier.phone}

  return {"status": "not_found"}


def lookup_vehicle(db: Session, plate: str, current_user) -> Optional[Vehicle]:
  
  plate = normalize_plate(plate)
  
  if not plate:
    return {"status": "not_found"}

  if is_document_blacklisted(db, PLATE_BLACKLIST_TYPE, plate):
    return {"status": "blocked", "subject": "vehicle"}

  vehicle = db.query(Vehicle).filter(Vehicle.plate == plate).first()
  
  if not vehicle:
    return {"status": "not_found"}

  # Un vehículo inactivo tampoco se puede usar: el envío lo rechazaría
  if not vehicle.is_active:
    return {"status": "blocked", "subject": "vehicle"}

  # Un cliente solo recibe datos de lo que su propia empresa ya usó
  if current_user.role in CLIENT_ROLES and not _used_by_company(db, current_user.company_id, vehicle_id=vehicle.id):
    return {"status": "not_found"}

  if vehicle.owner_document_id and is_document_blacklisted(db, vehicle.owner_document_type, vehicle.owner_document_id):
    return {"status": "blocked", "subject": "owner"}

  return {"status": "found", "vehicle": vehicle}


def lookup_carrier(db: Session, document_type: str, document_id: str, current_user) -> Optional[Carrier]:
  
  document_id = (document_id or "").strip()
  
  if not document_id:
    return {"status": "not_found"}

  if is_document_blacklisted(db, document_type, document_id):
    return {"status": "blocked"}

  carrier = (
    db.query(Carrier)
    .filter(Carrier.document_type == document_type, Carrier.document_id == document_id)
    .first()
  )

  if not carrier:
    return {"status": "not_found"}

  if not carrier.is_active:
    return {"status": "blocked"}

  if current_user.role in CLIENT_ROLES and not _used_by_company(db, current_user.company_id, carrier_id=carrier.id):
    return {"status": "not_found"}

  return {"status": "found", "carrier": carrier}


def review_transport_document(db: Session, order_id: UUID, document_id: UUID, status: str, reason: Optional[str], current_user) -> Document:

  assignment = get_assignment_by_order(db, order_id)
  
  if not assignment:
    raise ValueError("Assignment not found for this order")
  
  if assignment.validation_status != "pending":
    raise ValueError("Documents can only be reviewed while the transport is pending")

  document = get_transport_document(db, order_id, document_id)

  if document.status != "pending":
    raise ValueError(
      f"This document was already {document.status}. "
      "It can be reviewed again only after the client replaces it"
    )
  
  reason = (reason or "").strip()
  if status == "rejected" and not reason:
    raise ValueError("A reason is required when rejecting a document")

  document.status = status
  document.rejection_reason = reason.strip() if status == "rejected" else None
  document.updated_by_user_id = current_user.id

  db.commit()
  db.refresh(document)
  
  return document
