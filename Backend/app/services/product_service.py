from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.product import Product
from app.schemas.product import ProductCreate
from app.constants.units import VALID_UNITS


def get_products(db: Session) -> list[Product]:
    return db.query(Product).filter(Product.is_active == True).all()


def get_product_by_id(db: Session, product_id: UUID) -> Optional[Product]:
    return db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()


# Valida las unidades de medida
def _validate_unit(unit: str):
    if unit not in VALID_UNITS:
        raise ValueError(f"Invalid unit. Allowed values: {VALID_UNITS}")


def _validate_pack_fields(db: Session, parent_product_id: Optional[UUID], units_per_pack: Optional[Decimal]):
    if (parent_product_id is None) != (units_per_pack is None):
        raise ValueError("parent_product_id y units_per_pack deben venir juntos, o ninguno de los dos")

    if parent_product_id is not None:
        parent = db.query(Product).filter(Product.id == parent_product_id).first()

        if not parent:
            raise ValueError("El producto base (parent_product_id) no existe")
        if parent.parent_product_id is not None:
            raise ValueError("No se puede crear un paquete a partir de otro paquete")
        if units_per_pack <= 0:
            raise ValueError("units_per_pack debe ser mayor a cero")

        return parent

    return None


def _resolve_approx_weight(data: ProductCreate, parent: Optional[Product]) -> Optional[Decimal]:
    # Si el usuario ya escribió un peso explícito, se respeta tal cual venga
    if data.approx_weight_kg is not None:
        return data.approx_weight_kg

    # Si es un paquete y el padre tiene peso de referencia, se calcula automático
    if parent is not None and parent.approx_weight_kg is not None:
        return parent.approx_weight_kg * data.units_per_pack

    return None


def create_product(db: Session, data: ProductCreate) -> Product:
    _validate_unit(data.unit)
    parent = _validate_pack_fields(db, data.parent_product_id, data.units_per_pack)

    new_product = Product(
        name=data.name,
        category=data.category,
        price=data.price,
        tax_rate=data.tax_rate,
        unit=data.unit,
        approx_weight_kg=_resolve_approx_weight(data, parent),
        parent_product_id=data.parent_product_id,
        units_per_pack=data.units_per_pack,
    )
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    return new_product


def edit_product(db: Session, product_id: UUID, data: ProductCreate) -> Optional[Product]:
    product_exists = get_product_by_id(db, product_id)

    if not product_exists:
        return None

    _validate_unit(data.unit)
    parent = _validate_pack_fields(db, data.parent_product_id, data.units_per_pack)

    product_exists.name = data.name
    product_exists.category = data.category
    product_exists.price = data.price
    product_exists.tax_rate = data.tax_rate
    product_exists.unit = data.unit
    product_exists.approx_weight_kg = _resolve_approx_weight(data, parent)
    product_exists.parent_product_id = data.parent_product_id
    product_exists.units_per_pack = data.units_per_pack

    db.commit()
    db.refresh(product_exists)
    
    return product_exists


def deactivate_product(db: Session, product_id: UUID) -> Optional[Product]:
    product_exists = get_product_by_id(db, product_id)
    
    if not product_exists:
        return None
    
    product_exists.is_active = False
    
    db.commit()
    db.refresh(product_exists)
    
    return product_exists