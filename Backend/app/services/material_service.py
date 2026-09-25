from decimal import Decimal
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


def _validate_pack_fields(db: Session, parent_material_id: Optional[UUID], units_per_pack: Optional[Decimal]):
    if (parent_material_id is None) != (units_per_pack is None):
        raise ValueError("parent_material_id y units_per_pack deben venir juntos, o ninguno de los dos")

    if parent_material_id is not None:
        parent = db.query(Material).filter(Material.id == parent_material_id).first()
        if not parent:
            raise ValueError("El producto base (parent_material_id) no existe")
        if parent.parent_material_id is not None:
            raise ValueError("No se puede crear un paquete a partir de otro paquete")
        if units_per_pack <= 0:
            raise ValueError("units_per_pack debe ser mayor a cero")

        return parent

    return None


def _resolve_approx_weight(material: MaterialCreate, parent: Optional[Material]) -> Optional[Decimal]:
    # Si el usuario ya escribió un peso explícito, se respeta tal cual venga
    if material.approx_weight_kg is not None:
        return material.approx_weight_kg

    # Si es un paquete y el padre tiene peso de referencia, se calcula automático
    if parent is not None and parent.approx_weight_kg is not None:
        return parent.approx_weight_kg * material.units_per_pack

    return None


def create_material(db: Session, material: MaterialCreate) -> Material:
    _validate_unit(material.unit)
    parent = _validate_pack_fields(db, material.parent_material_id, material.units_per_pack)

    new_material = Material(
        name=material.name,
        category=material.category,
        price=material.price,
        tax_rate=material.tax_rate,
        unit=material.unit,
        approx_weight_kg=material.approx_weight_kg,
        parent_material_id=material.parent_material_id,
        units_per_pack=material.units_per_pack,
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
    parent = _validate_pack_fields(db, material.parent_material_id, material.units_per_pack)

    material_exists.name = material.name
    material_exists.category = material.category
    material_exists.price = material.price
    material_exists.tax_rate = material.tax_rate
    material_exists.unit = material.unit
    material_exists.approx_weight_kg = material.approx_weight_kg
    material_exists.parent_material = material.parent_material_id
    material.units_per_pack = material.units_per_pack

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