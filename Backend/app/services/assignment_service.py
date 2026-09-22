from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.assignment import Assignment
from app.models.order import Order
from app.models.vehicle import Vehicle
from app.models.carrier import Carrier
from app.models.document_blacklist import DocumentBlacklist
from app.services.document_blacklist_service import is_document_blacklisted
from app.services.order_service import can_access_order


# Lista las asignaciones.
def get_assignments(db: Session) -> List[Assignment]:
    return db.query(Assignment).all()


# Trae una asignación por id de orden
def get_assignment_by_order(db: Session, order_id: UUID) -> Optional[Assignment]:
    return db.query(Assignment).filter(Assignment.order_id == order_id).first()


# Busca o crea un vehículo
def _find_or_create_vehicle(db: Session, data) -> Vehicle:
    vehicle = db.query(Vehicle).filter(Vehicle.plate == data.plate).first()
    
    if vehicle:
        if not vehicle.is_active:
            raise ValueError("This vehicle is inactive and cannot be used")
        return vehicle

    new_vehicle = Vehicle(type=data.type, capacity_m3=data.capacity_m3, plate=data.plate)
    
    db.add(new_vehicle)
    db.flush()  # asigna el id sin cerrar la transacción todavía
    
    return new_vehicle



# Busca o crea un transportador.
def _find_or_create_carrier(db: Session, data) -> Carrier:
    carrier = (
        db.query(Carrier)
        .filter(Carrier.document_type == data.document_type, Carrier.document_id == data.document_id)
        .first()
    )

    blacklist_entry = is_document_blacklisted(db, data.document_type, data.document_id)
    
    if blacklist_entry:
        raise ValueError(f"This carrier's document is blacklisted: {blacklist_entry.reason}")

    if carrier:
        if not carrier.is_active:
            raise ValueError("This carrier is inactive and cannot be used")
        return carrier

    new_carrier = Carrier(
        full_name=data.full_name,
        document_type=data.document_type,
        document_id=data.document_id,
        phone=data.phone,
        address=data.address,
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

    if order.status != "payment_confirmed":
        raise ValueError("Order must have payment confirmed before submitting transport")

    existing = get_assignment_by_order(db, data.order_id)

    if existing:
        raise ValueError(
            "This order already has a transport submission. "
            "If it was rejected, use the resubmit endpoint instead."
        )

    vehicle = _find_or_create_vehicle(db, data.vehicle)
    carrier = _find_or_create_carrier(db, data.carrier)

    new_assignment = Assignment(
        order_id=data.order_id,
        vehicle_id=vehicle.id,
        carrier_id=carrier.id,
        validation_status="pending",
    )

    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    
    return new_assignment


# Si se rechaza el vehículo o transportador, se reenvía la información con un nuevo vehículo/transportador.
def resubmit_assignment(db: Session, order_id: UUID, vehicle_data, carrier_data, current_user) -> Assignment:
    order = db.query(Order).filter(Order.id == order_id).first()

    if not order:
        raise ValueError("Order not found")

    if not can_access_order(order, current_user):
        raise ValueError("Order not found")

    assignment = get_assignment_by_order(db, order_id)
    
    if not assignment:
        raise ValueError("No transport submission found for this order")

    if assignment.validation_status != "rejected":
        raise ValueError("Only a rejected transport submission can be resubmitted")

    vehicle = _find_or_create_vehicle(db, vehicle_data)
    carrier = _find_or_create_carrier(db, carrier_data)

    assignment.vehicle_id = vehicle.id
    assignment.carrier_id = carrier.id
    assignment.validation_status = "pending"
    assignment.rejection_reason = None
    assignment.background_check_verified = False
    assignment.validated_at = None
    assignment.validated_by_user_id = None

    db.commit()
    db.refresh(assignment)
    
    return assignment


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

    if decision == "approved" and not background_check_verified:
        raise ValueError("Must confirm background_check_verified before approving")

    assignment.validation_status = decision
    assignment.rejection_reason = rejection_reason if decision == "rejected" else None
    assignment.background_check_verified = background_check_verified
    assignment.validated_at = datetime.utcnow()
    assignment.validated_by_user_id = current_user.id

    if decision == "approved":
        order = db.query(Order).filter(Order.id == assignment.order_id).first()
        order.status = "transport_validated"

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

    db.commit()
    db.refresh(assignment)
    return assignment