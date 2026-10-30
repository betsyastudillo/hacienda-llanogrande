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
from app.services.assignment_service import attach_transport_details


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

  verification_url = f"{settings.base_url}/dispatch-guides/verify/{token}"
  
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


def verify_dispatch_guide(db: Session, token: str, current_user=None) -> dict:

  guide = db.query(DispatchGuide).filter(DispatchGuide.token == token).first()
  
  if not guide:
    raise ValueError("Invalid token")
  
  # Validación para un solo uso
  if guide.status == "used":
    raise ValueError("This dispatch guide has already been used")

  assignment = db.query(Assignment).filter(Assignment.order_id == guide.order_id).first()

  if not assignment:
    raise ValueError("No transport assignment found for this order")
  
  vehicle = db.query(Vehicle).filter(Vehicle.id == assignment.vehicle_id).first()
  carrier = db.query(Carrier).filter(Carrier.id == assignment.carrier_id).first()

  guide.status = "used"
  guide.used_at = datetime.now(timezone.utc)

  order = db.query(Order).filter(Order.id == guide.order_id).first()
  order.status = "dispatched"

  if current_user:
    guide.updated_by_user_id = current_user.id
    order.updated_by_user_id = current_user.id

  db.commit()

  return {
    "order_id": guide.order_id,
    "status": guide.status,
    "origin": guide.origin,
    "destination": guide.destination,
    "cargo_detail": guide.cargo_detail,
    "carrier_name": carrier.full_name,
    "carrier_document": carrier.document_id,
    "vehicle_plate": vehicle.plate,
    "vehicle_type": vehicle.type,
  }

