from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate


def get_vehicles(db: Session) -> list[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.is_active == True).all()


def get_vehicle_by_id(db: Session, vehicle_id: UUID) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()


def create_vehicle(db: Session, vehicle: VehicleCreate) -> Vehicle:
    new_vehicle = Vehicle(
        type=vehicle.type,
        capacity_m3=vehicle.capacity_m3,
        plate=vehicle.plate,
    )
    
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    
    return new_vehicle


def edit_vehicle(db: Session, vehicle_id: UUID, vehicle: VehicleCreate) -> Optional[Vehicle]:
    vehicle_exists = get_vehicle_by_id(db, vehicle_id)
    
    if not vehicle_exists:
        return None

    vehicle_exists.type = vehicle.type
    vehicle_exists.capacity_m3 = vehicle.capacity_m3
    vehicle_exists.plate = vehicle.plate

    db.commit()
    db.refresh(vehicle_exists)
    
    return vehicle_exists


def deactivate_vehicle(db: Session, vehicle_id: UUID) -> Optional[Vehicle]:
    vehicle = get_vehicle_by_id(db, vehicle_id)

    if not vehicle:
        return None
    
    vehicle.is_active = False
    db.commit()
    return vehicle