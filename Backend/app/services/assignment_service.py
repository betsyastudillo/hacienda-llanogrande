from datetime import date
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.assignment import Assignment
from app.models.order import Order
from app.models.vehicle import Vehicle
from app.models.carrier import Carrier
from app.schemas.assignment import AssignmentCreate


ASSIGNABLE_ORDER_STATUSES = ["created"]  


def get_assignments(db: Session,) -> list[Assignment]:
    return db.query(Assignment).all()


def get_assignment_by_order(db: Session, order_id: UUID) -> Optional[Assignment]:
    return db.query(Assignment).filter(Assignment.order_id == order_id).first()


def create_assignment(db: Session, data: AssignmentCreate) -> Assignment:
    order = db.query(Order).filter(Order.id == data.order_id).first()

    if not order:
        raise ValueError("Order not found")
    
    if order.status not in ASSIGNABLE_ORDER_STATUSES:
        raise ValueError(f"Order must be in one of {ASSIGNABLE_ORDER_STATUSES} to assign transport")

    existing = db.query(Assignment).filter(Assignment.order_id == data.order_id).first()
    
    if existing:
        raise ValueError("Order already has a transport assignment")

    vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
    
    if not vehicle or not vehicle.is_active:
        raise ValueError("Vehicle not found or inactive")
    
    if vehicle.soat_expiration_date < date.today():
        raise ValueError("Vehicle SOAT is expired")
    
    if vehicle.technical_inspection_expiration_date < date.today():
        raise ValueError("Vehicle technical inspection is expired")

    carrier = db.query(Carrier).filter(Carrier.id == data.carrier_id).first()
    
    if not carrier or not carrier.is_active:
        raise ValueError("Carrier not found or inactive")
    
    if carrier.license_expiration_date < date.today():
        raise ValueError("Carrier license is expired")

    total_quantity = sum(item.quantity_m3 for item in order.items)
    
    if vehicle.capacity_m3 < total_quantity:
        raise ValueError(
            f"Vehicle capacity ({vehicle.capacity_m3} m3) is insufficient for order quantity ({total_quantity} m3)"
        )

    order.status = "transport_assigned"

    new_assignment = Assignment(
        order_id=data.order_id,
        vehicle_id=data.vehicle_id,
        carrier_id=data.carrier_id,
    )
    
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    return new_assignment

