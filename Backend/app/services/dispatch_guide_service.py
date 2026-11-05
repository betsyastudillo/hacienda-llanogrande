import os
import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
import qrcode
from sqlalchemy.orm import Session
from app.models.dispatch_guide import DispatchGuide
from app.models.order import Order
from app.models.company import Company
from app.models.assignment import Assignment
from app.models.vehicle import Vehicle
from app.models.carrier import Carrier
from app.config import settings
from app.models.vehicle_type import VehicleType
from app.services.assignment_service import attach_transport_details
from app.services.inventory_service import register_order_deduction


QR_UPLOAD_DIR = "uploads/dispatch_guides"

def _location(c: Company) -> str:
  return ", ".join(x for x in [c.address, c.city, c.department] if x)


def get_dispatch_guides(db: Session) -> list[DispatchGuide]:
  return db.query(DispatchGuide).all()


def get_dispatch_guide_by_order(db: Session, order_id: UUID) -> Optional[DispatchGuide]:
  return db.query(DispatchGuide).filter(DispatchGuide.order_id == order_id).first()


def build_cargo_detail(order: Order) -> str:
  
  parts = [f"{item.quantity_m3} m3 {item.product.name}" for item in order.items]
  
  return ", ".join(parts)


def generate_qr_image(order_id: UUID, token: str) -> str:

  folder = os.path.join(QR_UPLOAD_DIR, str(order_id))
  os.makedirs(folder, exist_ok=True)
  file_path = os.path.join(folder, "qr.png")

  #rstrip evita dobles barras por si dejan / al final
  verification_url = f"{settings.frontend_url.rstrip('/')}/dispatch-guides/verify/{token}"
  
  # Con qrcode.make(...) el QR no cotiene los datos de despacho directamente, contiene la URL de verificación con el token para evitar falsificación de datos.
  img = qrcode.make(verification_url)
  img.save(file_path)

  return f"/{file_path}"


def create_dispatch_guide(db: Session, order_id: UUID, current_user) -> DispatchGuide:

  order = db.query(Order).filter(Order.id == order_id).first()

  if not order:
    raise ValueError("Order not found")

  existing = db.query(DispatchGuide).filter(DispatchGuide.order_id == order_id).first()

  if existing:
    raise ValueError("A dispatch guide already exists for this order")

  # La guía solo se genera cuando logística ya aprobó el transporte
  if order.status != "transport_validated":
    raise ValueError(
      f"The order transport must be validated before generating the dispatch guide (current status: {order.status})"
    )

  assignment = db.query(Assignment).filter(Assignment.order_id == order_id).first()

  if not assignment:
    raise ValueError("Order has no transport assignment yet")

  if assignment.validation_status != "approved":
    raise ValueError(
      f"The transport must be approved before generating the dispatch guide (current: {assignment.validation_status})"
    )

  # El veto puede aparecer después de aprobar: se vuelve a revisar
  if attach_transport_details(db, [assignment])[0].blocked:
    raise ValueError("The vehicle, its owner or the carrier is on the blacklist: the dispatch guide cannot be generated")
  
  plant = db.query(Company).filter(Company.company_type == "own").first()

  if not plant or not plant.address:
    raise ValueError("Own company record not found. Create it first with type'own'")
  
  destination_company = db.query(Company).filter(Company.id == order.company_id).first()

  # Genera un token aleatorio, largo, imposible de adivinar.
  token = secrets.token_urlsafe(32)

  new_guide = DispatchGuide(
    order_id=order_id,
    token=token,
    status="pending",
    origin=_location(plant),
    destination=_location(destination_company),
    cargo_detail=build_cargo_detail(order),
    created_by_user_id = current_user.id,
  )

  new_guide.qr_image_url = generate_qr_image(order_id, token)

  db.add(new_guide)

  order.status = "dispatch_guide_generated"
  order.updated_by_user_id = current_user.id
  
  db.commit()
  db.refresh(new_guide)
  
  return new_guide


def _load_guide_context(db: Session, token: str):
  guide = db.query(DispatchGuide).filter(DispatchGuide.token == token).first()

  if not guide:
    raise ValueError("Invalid token")

  order = db.query(Order).filter(Order.id == guide.order_id).first()
  assignment = db.query(Assignment).filter(Assignment.order_id == guide.order_id).first()

  if not assignment:
    raise ValueError("No transport assignment found for this order")

  vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()
  carrier = db.query(Carrier).filter(Carrier.id == assignment.carrier_id).first()
  detail = attach_transport_details(db, [assignment])[0]

  return guide, order, vehicle, carrier, detail


def _build_verification(db: Session, guide, vehicle, carrier, detail) -> dict:
  blocked = bool(detail.blocked)
  vehicle_type = db.query(VehicleType).filter(VehicleType.code == vehicle.type).first()

  return {
    "order_id": guide.order_id,
    "status": guide.status,
    "origin": guide.origin,
    "destination": guide.destination,
    "cargo_detail": guide.cargo_detail,
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
  guide, order, vehicle, carrier, detail = _load_guide_context(db, token)
  return _build_verification(db, guide, vehicle, carrier, detail)


def register_guide_entry(db: Session, token: str, current_user) -> dict:
  guide, order, vehicle, carrier, detail = _load_guide_context(db, token)

  if guide.status != "pending":
    raise ValueError(f"Esta guía no está pendiente de ingreso (estado actual: {guide.status})")

  if detail.blocked:
    raise ValueError("El vehículo, su propietario o el transportador no están autorizados: ingreso bloqueado")

  guide.status = "in_plant"
  guide.entered_at = datetime.now(timezone.utc)
  guide.updated_by_user_id = current_user.id

  db.commit()

  return _build_verification(db, guide, vehicle, carrier, detail)


def register_guide_exit(db: Session, token: str, current_user) -> dict:
  guide, order, vehicle, carrier, detail = _load_guide_context(db, token)

  if guide.status == "used":
    raise ValueError("Esta guía ya fue utilizada")

  if guide.status != "in_plant":
    raise ValueError("La guía no registra ingreso a la planta")

  guide.status = "used"
  guide.used_at = datetime.now(timezone.utc)
  guide.updated_by_user_id = current_user.id

  order.status = "dispatched"
  order.updated_by_user_id = current_user.id

  for item in order.items:
    register_order_deduction(db, item.product, order.id, item.quantity_m3, current_user)

  db.commit()

  return _build_verification(db, guide, vehicle, carrier, detail)