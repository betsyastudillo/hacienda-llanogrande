from typing import Optional, List
from uuid import UUID
from decimal import ROUND_DOWN, Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.inventory_movement import InventoryMovement
from app.models.material import Material

# Trae el inventario
def get_current_stock(db: Session, material_id: UUID) -> Decimal:
    def total_for(movement_type: str) -> Decimal:
        result = (
            # coalesce: función de SQL que dice: si este valor es NULL, usa este otro valor en su lugar.
            # Si no hay movimientos de entrada de X producto, garantiza que el resultado sea 0 y no NULL.
            db.query(func.coalesce(func.sum(InventoryMovement.quantity), 0))
            .filter(InventoryMovement.material_id == material_id, InventoryMovement.movement_type == movement_type)
            .scalar()
        )
        return Decimal(result)

    return total_for("entrada") - total_for("salida") + total_for("ajuste")


# Si el producto es un paquete, devuelve su producto base donde realmente vive el inventario, si no, se devuelve a si mismo 
def resolve_stock_target(material: Material) -> Material:

    return material.parent_material if material.parent_material_id else material


# Convierte los paqetes/unidades que pide el cliente a las und a descontar del inventario del producto base.
def get_deduction_quantity(material: Material, quantity_ordered: int) -> int:

    if material.parent_material_id:
        raw = Decimal(quantity_ordered) * material.units_per_pack
        if raw != raw.to_integral_value():
            raise ValueError(
                f"El descuento resultante ({raw}) no es un número entero — "
                f"revisa units_per_pack de {material.name}"
            )
        return int(raw)
    return quantity_ordered


# Trae los movimientos que ha tenido un producto
def get_movements_by_product(db: Session, material_id: UUID) -> List[InventoryMovement]:
    return (
        db.query(InventoryMovement)
        .filter(InventoryMovement.material_id == material_id)
        .order_by(InventoryMovement.created_at.desc())
        .all()
    )


# Crea un movimiento
def create_manual_movement(
    db: Session, material_id: UUID, movement_type: str, quantity: int, reason: Optional[str], current_user
) -> InventoryMovement:
    
    material = db.query(Material).filter(Material.id == material_id).first()
    
    if not material:
        raise ValueError("Material not found")

    if material.parent_material_id:
        raise ValueError("No se pueden registrar movimientos manuales sobre un paquete — usa el producto base")
    
    if movement_type == "entrada" and quantity <= 0:
        raise ValueError("La cantidad de entrada debe ser positiva")

    if movement_type == "ajuste" and quantity == 0:
        raise ValueError("El ajuste no puede ser cero")

    movement = InventoryMovement(
        material_id=material_id,
        movement_type=movement_type,
        quantity=quantity,
        reason=reason,
        created_by_user_id=current_user.id,
    )
    
    db.add(movement)
    db.commit()
    db.refresh(movement)
    
    return movement


# Registra la salida de inventario por pedido, resuelve automáticamente que si el material es un paquete lo descuenta del producto base. Se guarda junto a la transacción de create_order, por lo tanto, no hace commit
def register_order_deduction(db: Session, material: Material, order_id: UUID, quantity_ordered: int, current_user) -> InventoryMovement:

    stock_target = resolve_stock_target(material)
    deduction_qty = get_deduction_quantity(material, quantity_ordered)

    reason = "Descuento automático por pedido"

    if material.parent_material_id:
        reason += f"({quantity_ordered} paquete(s) de {material.name})"

    movement = InventoryMovement(
        material_id=stock_target.id,
        order_id=order_id,
        movement_type="salida",
        quantity=deduction_qty,
        reason=reason,
        created_by_user_id=current_user.id if current_user else None,
    )

    db.add(movement)
    
    return movement


# Cuantas unds de este producto específico se pueden vender ahora mismo. Si es un pqt, es el stock base / units_per_pack (redondeado hacia abajo).
def get_sellable_stock(db: Session, material: Material) -> int:

    stock_target = resolve_stock_target(material)
    base_stock = get_current_stock(db, stock_target.id)

    if material.parent_material_id:
        return int((base_stock / material.units_per_pack).to_integral_value(rounding=ROUND_DOWN))

    return int(base_stock)