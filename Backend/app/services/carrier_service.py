from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.carrier import Carrier
from app.schemas.carrier import CarrierCreate


def get_carriers(db: Session) -> list[Carrier]:
    return db.query(Carrier).filter(Carrier.is_active == True).all()


def get_carrier_by_id(db: Session, carrier_id: UUID) -> Optional[Carrier]:
    return db.query(Carrier).filter(Carrier.id == carrier_id).first()


def create_carrier(db:Session, carrier: CarrierCreate) -> Carrier:
    new_carrier = Carrier(**carrier.model_dump())
    
    db.add(new_carrier)
    db.commit()
    db.refresh(new_carrier)
    
    return new_carrier


def edit_carrier(db: Session, carrier_id: UUID, carrier: CarrierCreate) -> Optional[Carrier]:
    carrier_exists = get_carrier_by_id(db, carrier_id)
    
    if not carrier_exists:
        return None
    
    for key, value in carrier.model_dump().items():
        setattr(carrier, key, value)
    
    db.commit()
    db.refresh(carrier_exists)
    return carrier_exists


def deactivate_carrier(db:Session, carrier_id: UUID) -> Optional[Carrier]:
    carrier = get_carrier_by_id(db, carrier_id)

    if not carrier:
        return None
    
    carrier.is_active = False

    db.commit()
    return carrier