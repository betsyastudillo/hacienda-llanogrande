import os
import secrets
import qrcode
from datetime import datetime, timezone
from typing import List
from uuid import UUID
from sqlalchemy.orm import Session
from app.config import settings
from app.models.assignment import Assignment
from app.models.carrier import Carrier
from app.models.company import Company
from app.models.dispatch_guide import DispatchGuide
from app.models.order import Order
from app.models.vehicle import Vehicle
from app.models.vehicle_type import VehicleType
from app.services.assignment_service import attach_transport_details
from app.services.inventory_service import register_order_deduction
from app.services.order_service import WITHDRAWAL_ORDER_STATUSES, get_item_quantities

QR_UPLOAD_DIR = "uploads/dispatch_guides"


def _qty_label(quantity: int, product) -> str:
  return f"{quantity} {product.unit} {product.name}"


def _location(c: Company) -> str:
  return ", ".join(x for x in [c.address, c.city, c.department] if x)


def get_dispatch_guides(db: Session) -> list[DispatchGuide]:
  return db.query(DispatchGuide).all()


# Guías de un pedido, en el orden de sus retiros
def get_dispatch_guides_by_order(db: Session, order_id: UUID) -> List[DispatchGuide]:
  return (
    db.query(DispatchGuide)
    .join(Assignment, Assignment.id == DispatchGuide.assignment_id)
    .filter(DispatchGuide.order_id == order_id)
    .order_by(Assignment.sequence)
    .all()
  )


# Lo que se lleva este retiro
def build_cargo_detail(assignment: Assignment) -> str:
  
  parts = [_qty_label(ai.quantity, ai.order_item.product) for ai in assignment.items]
  
  return ", ".join(parts)


# Lo que queda por retirar después de este retiro (el pedido menos lo ya despachado y lo de este retiro)
def build_balance_detail(db: Session, order: Order, assignment: Assignment) -> str:
  _, dispatched = get_item_quantities(db, order.id)
  this_withdrawal = {ai.order_item_id: ai.quantity for ai in assignment.items}
  parts = []

  for item in order.items:
    remaining = item.quantity_m3 - dispatched.get(item.id, 0) - this_withdrawal.get(item.id, 0)

    if remaining > 0:
      parts.append(_qty_label(remaining, item.product))

    if not parts:
      return "Sin saldo: con este retiro se completa el pedido"
    
    return "Saldo pendiente: " + ", ".join(parts)


def generate_qr_image(assignment_id: UUID, token: str) -> str:

  folder = os.path.join(QR_UPLOAD_DIR, str(assignment_id))
  os.makedirs(folder, exist_ok=True)
  file_path = os.path.join(folder, "qr.png")

  #rstrip evita dobles barras por si dejan / al final
  verification_url = f"{settings.frontend_url.rstrip('/')}/dispatch-guides/verify/{token}"
  
  # Con qrcode.make(...) el QR no contiene los datos de despacho, solo la URL con el token, para evitar falsificación de datos.
  img = qrcode.make(verification_url)
  img.save(file_path)

  return f"/{file_path}"


def create_dispatch_guide(db: Session, assignment_id: UUID, current_user) -> DispatchGuide:

  assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()

  if not assignment:
    raise ValueError("Assignment not found")
  
  if assignment.cancelled_at:
    raise ValueError("Este retiro fue anulado")

  order = db.query(Order).filter(Order.id == assignment.order_id).first()

  if order.status not in WITHDRAWAL_ORDER_STATUSES:
    raise ValueError(f"No se puede generar la guía con el pedido en estado {order.status}")
  
  existing = db.query(DispatchGuide).filter(DispatchGuide.assignment_id == assignment_id).first()

  if existing:
    raise ValueError("Este retiro ya tiene una guía de despacho generada")

  # La guía solo se genera cuando logística ya aprobó el transporte
  if assignment.validation_status != "approved":
    raise ValueError(
      f"El transporte debe ser aprobado antes de generar la guía de despacho (estado actual: {assignment.validation_status})"
    )

  if not assignment.items:
    raise ValueError("Este retiro no tiene cantidades registradas")
  
  # El veto puede aparecer después de aprobar: se vuelve a revisar
  if attach_transport_details(db, [assignment])[0].blocked:
    raise ValueError("El vehículo, su propietario o el transportador está en la lista negra: no se puede generar la guía de despacho")
  
  plant = db.query(Company).filter(Company.company_type == "own").first()

  if not plant or not plant.address:
    raise ValueError("No se encuentra el registro de la empresa propia. Créelo primero con tipo 'own'")
  
  destination_company = db.query(Company).filter(Company.id == order.company_id).first()

  # Token aleatorio, largo, imposible de adivinar.
  token = secrets.token_urlsafe(32)

  new_guide = DispatchGuide(
    order_id=order.id,
    assignment_id=assignment.id,
    token=token,
    status="pending",
    origin=_location(plant),
    destination=_location(destination_company),
    cargo_detail=build_cargo_detail(assignment),
    balance_detail=build_balance_detail(db, order, assignment),
    created_by_user_id = current_user.id,
  )

  new_guide.qr_image_url = generate_qr_image(assignment.id, token)
  
  db.add(new_guide)
  db.commit()
  db.refresh(new_guide)
  
  return new_guide


def _load_guide_context(db: Session, token: str):
  guide = db.query(DispatchGuide).filter(DispatchGuide.token == token).first()

  if not guide:
    raise ValueError("Invalid token")

  assignment = db.query(Assignment).filter(Assignment.id == guide.assignment_id).first()

  if not assignment:
    raise ValueError("No transport assignment found for this order")
  
  if assignment.cancelled_at:
    raise ValueError("Este retiro fue anulado: la guía ya no es válida")
  
  order = db.query(Order).filter(Order.id == guide.order_id).first()
  vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()
  carrier = db.query(Carrier).filter(Carrier.id == assignment.carrier_id).first()
  detail = attach_transport_details(db, [assignment])[0]

  return guide, order, assignment, vehicle, carrier, detail


def _build_verification(db: Session, guide, order, assignment, vehicle, carrier, detail) -> dict:
  blocked = bool(detail.blocked)
  vehicle_type = db.query(VehicleType).filter(VehicleType.code == vehicle.type).first()

  return {
    "order_id": guide.order_id,
    "order_number": order.order_number,
    "sequence": assignment.sequence,
    "status": guide.status,
    "origin": guide.origin,
    "destination": guide.destination,
    "cargo_detail": guide.cargo_detail,
    "balance_detail": guide.balance_detail,
    "carrier_name": carrier.full_name,
    "carrier_document": carrier.document_id,
    "vehicle_plate": vehicle.plate,
    "vehicle_type": vehicle_type.name if vehicle_type else vehicle.type,
    "blocked": blocked,
    "entered_at": guide.entered_at,
    "used_at": guide.used_at,
    # Solo se bloquea el ingreso: un vehículo vetado que ya está dentro debe poder salir
    "can_enter": guide.status == "pending" and not blocked,
    "can_exit": guide.status == "in_plant",
  }


# Solo consulta: no cambia nada
def get_guide_for_verification(db: Session, token: str) -> dict:
  guide, order, assignment, vehicle, carrier, detail = _load_guide_context(db, token)
  return _build_verification(db, guide, order, assignment, vehicle, carrier, detail)


def register_guide_entry(db: Session, token: str, current_user) -> dict:
  guide, order, assignment, vehicle, carrier, detail = _load_guide_context(db, token)

  if guide.status != "pending":
    raise ValueError(f"Esta guía no está pendiente de ingreso (estado actual: {guide.status})")

  if detail.blocked:
    raise ValueError("El vehículo, su propietario o el transportador no están autorizados: ingreso bloqueado")

  guide.status = "in_plant"
  guide.entered_at = datetime.now(timezone.utc)
  guide.updated_by_user_id = current_user.id

  db.commit()

  return _build_verification(db, guide, order, assignment, vehicle, carrier, detail)


# Con cada salida se descuenta solo lo de ese retiro y el pedido pasa a: parcialmente despachado
def register_guide_exit(db: Session, token: str, current_user) -> dict:
  guide, order, assignment, vehicle, carrier, detail = _load_guide_context(db, token)

  if guide.status == "used":
    raise ValueError("Esta guía ya fue utilizada")

  if guide.status != "in_plant":
    raise ValueError("La guía no registra ingreso a la planta")

  guide.status = "used"
  guide.used_at = datetime.now(timezone.utc)
  guide.updated_by_user_id = current_user.id

  for ai in assignment.items:
    register_order_deduction(db, ai.order_item.product, order.id, ai.quantity, current_user)

  # flush explicito para que el conteo de despachado ya incluya este retiro
  db.flush()
  _, dispatched = get_item_quantities(db, order.id)

  complete = all(dispatched.get(item.id, 0) >= item.quantity_m3 for item in order.items)
  order.status = "dispatched" if complete else "partially_dispatched"
  order.updated_by_user_id = current_user.id

  db.commit()

  return _build_verification(db, guide, order, assignment, vehicle, carrier, detail)