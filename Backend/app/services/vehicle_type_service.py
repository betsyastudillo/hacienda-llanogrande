import re
import unicodedata
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.vehicle_type import VehicleType


def _make_code(name: str) -> str:
  ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
  return re.sub(r"[^a-z0-9]+", "_", ascii_name.lower()).strip("_")[:20]


def list_vehicle_types(db: Session, include_inactive: bool = False):
  query = db.query(VehicleType)
  if not include_inactive:
    query = query.filter(VehicleType.is_active.is_(True))
  return query.order_by(VehicleType.name).all()


def active_vehicle_type_codes(db: Session) -> set:
  rows = db.query(VehicleType.code).filter(VehicleType.is_active.is_(True)).all()
  return {r[0] for r in rows}


def create_vehicle_type(db: Session, name: str, current_user) -> VehicleType:
  code = _make_code(name)
  if not code:
    raise ValueError("El nombre no es válido")

  if db.query(VehicleType).filter(
    (VehicleType.code == code) | (func.lower(VehicleType.name) == name.lower())
  ).first():
    raise ValueError("Ya existe un tipo de vehículo con ese nombre")

  vehicle_type = VehicleType(
    code=code, name=name, is_active=True,
    created_by_user_id=current_user.id, updated_by_user_id=current_user.id,
  )
  db.add(vehicle_type)
  db.commit()
  db.refresh(vehicle_type)
  return vehicle_type


def update_vehicle_type(db: Session, type_id, name: Optional[str], is_active: Optional[bool], current_user) -> VehicleType:
  vehicle_type = db.query(VehicleType).filter(VehicleType.id == type_id).first()
  if not vehicle_type:
    raise ValueError("Tipo de vehículo no encontrado")

  if name is not None and name.lower() != vehicle_type.name.lower():
    if db.query(VehicleType).filter(
      func.lower(VehicleType.name) == name.lower(), VehicleType.id != type_id
    ).first():
      raise ValueError("Ya existe un tipo de vehículo con ese nombre")
    vehicle_type.name = name

  if is_active is not None:
    vehicle_type.is_active = is_active

  vehicle_type.updated_by_user_id = current_user.id
  db.commit()
  db.refresh(vehicle_type)
  return vehicle_type