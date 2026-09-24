from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.inventory_movement import InventoryMovement
from app.models.material import Material


# Trae el inventario
def get_current_stock(db: Session, material_id: UUID) -> Decimal:
    def total_for(movement_type: str) -> Decimal:
        result = (
            db.query(func.coalesce(func.sum(InventoryMovement.quantity), 0))
            .filter(InventoryMovement.material_id == material_id, InventoryMovement.movement_type == movement_type)
            .scalar()
        )
        return Decimal(result)

    return total_for("entrada") - total_for("salida") + total_for("ajuste")


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
    db: Session, material_id: UUID, movement_type: str, quantity: Decimal, reason: Optional[str], current_user
) -> InventoryMovement:
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise ValueError("Material not found")

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


# Registra la salida de inventario por pedido. Se guarda junto a la transacción de create_order
def register_order_deduction(db: Session, material_id: UUID, order_id: UUID, quantity: Decimal, current_user) -> InventoryMovement:

    movement = InventoryMovement(
        material_id=material_id,
        order_id=order_id,
        movement_type="salida",
        quantity=quantity,
        reason="Descuento automático por pedido",
        created_by_user_id=current_user.id if current_user else None,
    )
    db.add(movement)
    
    return movement