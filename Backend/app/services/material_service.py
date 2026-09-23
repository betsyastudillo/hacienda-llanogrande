from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.material import Material
from app.schemas.material import MaterialCreate
from app.constants.units import VALID_UNITS


def get_materials(db: Session) -> Optional[Material]:
    return db.query(Material).filter(Material.is_active == True).all()


def get_material_by_id(db: Session, material_id: UUID) -> Optional[Material]:
    return db.query(Material).filter(Material.id == material_id, Material.is_active == True).first()


# Valida las unidades de medida
def _validate_unit(unit: str):
    if unit not in VALID_UNITS:
        raise ValueError(f"Invalid unit. Allowed values: {VALID_UNITS}")


def create_material(db: Session, material: MaterialCreate) -> Material:
    _validate_unit(material.unit)

    new_material = Material(
        name=material.name,
        description=material.description,
        category=material.category,
        price=material.price,
        tax_rate=material.tax_rate,
        unit=material.unit,
        approx_weight_kg=material.approx_weight_kg,
    )
    
    db.add(new_material)
    db.commit()
    db.refresh(new_material)
    
    return new_material


def edit_material(db: Session, material_id: UUID, material: MaterialCreate) -> Optional[Material]:
    material_exists = get_material_by_id(db, material_id)

    if not material_exists:
        return None

    _validate_unit(material.unit)

    material_exists.name = material.name
    material_exists.description = material.description
    material_exists.category = material.category
    material_exists.price = material.price
    material_exists.tax_rate = material.tax_rate
    material_exists.unit = material.unit
    material_exists.approx_weight_kg = material.approx_weight_kg

    db.commit()
    db.refresh(material_exists)
    
    return material_exists


def deactivate_material(db: Session, material_id: UUID) -> Optional[Material]:
    material_exists = get_material_by_id(db, material_id)
    
    if not material_exists:
        return None
    
    material_exists.is_active = False
    
    db.commit()
    db.refresh(material_exists)
    
    return material_exists