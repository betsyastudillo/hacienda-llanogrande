from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.inventory_movement import InventoryMovement
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.material import Material
from app.models.company import Company
from app.models.user import User
from app.schemas.order import OrderCreate
from app.services.inventory_service import get_current_stock, register_order_deduction


CLIENT_ROLES = ("cliente_operativo", "cliente_admin")
STAFF_VIEW_ALL_ROLES = ("admin", "soporte")


def get_orders(db: Session, current_user: User) -> List[Order]:
    query = db.query(Order)

    if current_user.role in STAFF_VIEW_ALL_ROLES:
        return query.all()

    if current_user.role == "cliente_admin":
        return query.filter(Order.company_id == current_user.company_id).all()

    if current_user.role == "cliente_operativo":
        return query.filter(Order.created_by_user_id == current_user.id).all()

    # Cualquier otro rol de AridosCo (logistica, cartera, operaciones) ve todo por ahora. Ajustar en caso de ser necesario más adelante.
    return query.all()


def get_order_by_id(db: Session, order_id: UUID) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()


def can_access_order(order: Order, current_user: User) -> bool:
    if current_user.role in STAFF_VIEW_ALL_ROLES:
        return True
    
    if current_user.role == "cliente_admin":
        return order.company_id == current_user.company_id
    
    if current_user.role == "cliente_operativo":
        return order.created_by_user_id == current_user.id
    
    return True


def _resolve_company_id(order: OrderCreate, current_user: User) -> UUID:
    if current_user.role in CLIENT_ROLES:
        return current_user.company_id  # se ignora cualquier company_id que venga en el payload

    if current_user.role == "admin":
        if not order.company_id:
            raise ValueError("company_id is required when an admin creates an order on behalf of a client")
        return order.company_id

    raise ValueError("This role is not allowed to create orders")


def create_order(db: Session, order: OrderCreate, current_user: User) -> Order:

    company_id = _resolve_company_id(order, current_user)

    company = db.query(Company).filter(Company.id == company_id).first()

    if not company:
        raise ValueError("Company not found")
    
    if company.verification_status != "approved":
        raise ValueError("Company is not approved")

    new_order = Order(
        company_id=company_id, 
        created_by_user_id=current_user.id,
        status="created"
    )

    db.add(new_order)
    db.flush()  # Asigna el id al pedido sin cerrar la transacción todavía

    subtotal = Decimal("0")
    tax = Decimal("0")
    
    for item_data in order.items:
        material = db.query(Material).filter(Material.id == item_data.material_id).first()

        if not material:
            raise ValueError(f"Material with id {item_data.material_id} not found")
        
        if not material.is_active:
            raise ValueError(f"Material with id {item_data.material_id} is not active")

        item_subtotal = material.price * item_data.quantity_m3
        item_tax = item_subtotal * material.tax_rate
        subtotal += item_subtotal
        tax += item_tax

        order_item = OrderItem(
            order_id=new_order.id,
            material_id=item_data.material_id,
            quantity_m3=item_data.quantity_m3,
            unit_price=material.price,
            subtotal=item_subtotal
        )

        db.add(order_item)

        # register_order_deduction(db, material.id, new_order.id, item_data.quantity_m3, current_user)

    new_order.subtotal = subtotal
    new_order.tax = tax
    new_order.total = subtotal + tax
    db.commit()
    db.refresh(new_order)
    
    return new_order


def edit_order(db: Session, order_id: UUID, order_data: OrderCreate, current_user: User) -> Optional[Order]:
    order = get_order_by_id(db, order_id)

    if not order:
        return None
    
    if not can_access_order(order, current_user):
        raise PermissionError("You do not have permission to edit this order")
    
    if order.status != "created":
        raise ValueError("Only orders with status 'created' can be edited")
    
    # Se borran los items existentes antes de agregar los nuevos
    db.query(OrderItem).filter(OrderItem.order_id == order.id).delete()

    # Revierte las salidas del inventario que este pedido haya generado para poder recalcular el stock disponible correctamente con los nuevos items
    db.query(InventoryMovement).filter(
        InventoryMovement.order_id == order.id, InventoryMovement.movement_type == "salida"
    ).delete()

    db.flush()  # Asegura que los cambios se reflejen antes de agregar nuevos items

    subtotal = Decimal("0")
    tax = Decimal("0")

    for item_data in order_data.items:
        material = db.query(Material).filter(Material.id == item_data.material_id).first()

        if not material:
            raise ValueError(f"Material with id {item_data.material_id} not found")
        
        if not material.is_active:
            raise ValueError(f"Material with id {item_data.material_id} is not active")

        available_stock = get_current_stock(db, material.id)

        if item_data.quantity_m3 > available_stock:
            raise ValueError(
                f"Insufficient stock for {material.name}: requested {item_data.quantity_m3}, available {available_stock}"
            )
        
        item_subtotal = material.price * item_data.quantity_m3
        item_tax = item_subtotal * material.tax_rate
        subtotal += item_subtotal
        tax += item_tax

        order_item = OrderItem(
            order_id=order.id,
            material_id=item_data.material_id,
            quantity_m3=item_data.quantity_m3,
            unit_price=material.price,
            subtotal=item_subtotal
        )
        
        db.add(order_item)

        register_order_deduction(db, material.id, order.id, item_data.quantity_m3, current_user)

    order.subtotal = subtotal
    order.tax = tax
    order.total = subtotal + tax
    db.commit()
    db.refresh(order)
    
    return order