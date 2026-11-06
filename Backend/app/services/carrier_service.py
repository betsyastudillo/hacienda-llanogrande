from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.carrier import Carrier
from app.schemas.carrier import CarrierCreate


def get_carriers(db: Session) -> list[Carrier]:
    """Lista transportadores activos."""
    return db.query(Carrier).filter(Carrier.is_active == True).all()


def get_carrier_by_id(db: Session, carrier_id: UUID) -> Optional[Carrier]:
    """Busca un transportador por id."""
    return db.query(Carrier).filter(Carrier.id == carrier_id).first()


def create_carrier(db:Session, carrier: CarrierCreate) -> Carrier:
    """Crea un transportador (CRUD directo; en el flujo normal nacen al registrar un retiro)."""
    new_carrier = Carrier(
        full_name=carrier.full_name,
        document_type=carrier.document_type,
        document_id=carrier.document_id,
        phone=carrier.phone,
        address=carrier.address,
    )
    
    db.add(new_carrier)
    db.commit()
    db.refresh(new_carrier)
    
    return new_carrier


def edit_carrier(db: Session, carrier_id: UUID, carrier: CarrierCreate) -> Optional[Carrier]:
    """Actualiza un transportador. None si no existe."""
    carrier_exists = get_carrier_by_id(db, carrier_id)
    
    if not carrier_exists:
        return None
    
    carrier_exists.full_name = carrier.full_name
    carrier_exists.document_type = carrier.document_type
    carrier_exists.document_id = carrier.document_id
    carrier_exists.phone = carrier.phone
    carrier_exists.address = carrier.address
    
    db.commit()
    db.refresh(carrier_exists)
    
    return carrier_exists


def deactivate_carrier(db:Session, carrier_id: UUID) -> Optional[Carrier]:
    """Desactiva un transportador."""
    carrier = get_carrier_by_id(db, carrier_id)

    if not carrier:
        return None
    
    carrier.is_active = False

    db.commit()
    return carrier