from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload
from app.models.assignment import Assignment
from app.models.company import Company
from app.models.inventory_movement import InventoryMovement
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_counter import OrderCounter
from app.models.payment import Payment
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderCreate
from app.services.inventory_service import get_sellable_stock, register_order_deduction


CLIENT_ROLES = ("cliente_operativo", "cliente_admin")
STAFF_VIEW_ALL_ROLES = ("admin", "soporte")


# Genera los números de orden PED-2026-0000. Para facilitar las búsquedas.
def generate_order_number(db: Session) -> str:
  # Año en hora de Colombia (UTC-5)
  year = (datetime.utcnow() - timedelta(hours=5)).year

  stmt = (
    insert(OrderCounter)
    .values(year=year, last_number=1)
    .on_conflict_do_update(
        index_elements=[OrderCounter.year],
        set_={"last_number": OrderCounter.last_number + 1},
    )
    .returning(OrderCounter.last_number)
  )
  number = db.execute(stmt).scalar_one()

  return f"PED-{year}-{number:04d}"


def get_orders(db: Session, current_user: User) -> List[Order]:
  query = (
    db.query(Order)
    .options(joinedload(Order.company))
    .order_by(Order.created_at.desc())
  )

  if current_user.role == "cliente_admin":
    query = query.filter(Order.company_id == current_user.company_id)
  
  elif current_user.role == "cliente_operativo":
    query = query.filter(Order.created_by_user_id == current_user.id)

  return attach_needs_action(db, query.all(), current_user)


def get_order_by_id(db: Session, order_id: UUID) -> Optional[Order]:
  return db.query(Order).options(joinedload(Order.company)).filter(Order.id == order_id).first()


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


def _reverse_order_deductions(db: Session, order: Order, current_user: User) -> None:
  movements = db.query(InventoryMovement).filter(InventoryMovement.order_id == order.id).all()

  # Neto por producto: salidas menos entradas ya registradas para este pedido,
  # así una segunda edición no revierte dos veces lo mismo
  net = {}
  for m in movements:
    sign = 1 if m.movement_type == "salida" else -1 if m.movement_type == "entrada" else 0
    net[m.product_id] = net.get(m.product_id, 0) + sign * m.quantity

  for product_id, quantity in net.items():
    if quantity > 0:
      db.add(InventoryMovement(
        product_id=product_id,
        order_id=order.id,
        movement_type="entrada",
        quantity=quantity,
        reason=f"Reversión por edición del pedido {order.order_number}",
        created_by_user_id=current_user.id,
      ))


def create_order(db: Session, order: OrderCreate, current_user: User) -> Order:

  company_id = _resolve_company_id(order, current_user)

  company = db.query(Company).filter(Company.id == company_id).first()

  if not company:
      raise ValueError("Company not found")
  
  if not company.is_active:
    raise ValueError("La empresa está desactivada y no puede crear pedidos")

  if company.verification_status != "approved":
      raise ValueError("Company is not approved")

  new_order = Order(
    order_number=generate_order_number(db),
    company_id=company_id, 
    created_by_user_id=current_user.id,
    status="created"
  )

  db.add(new_order)
  db.flush()  # Asigna el id al pedido sin cerrar la transacción todavía

  subtotal = Decimal("0")
  tax = Decimal("0")
  
  for item_data in order.items:
      product = db.query(Product).filter(Product.id == item_data.product_id).first()

      if not product:
          raise ValueError(f"Product with id {item_data.product_id} not found")
      
      if not product.is_active:
          raise ValueError(f"Product with id {item_data.product_id} is not active")

      sellable = get_sellable_stock(db, product)
      
      if item_data.quantity_m3 > sellable:
          raise ValueError(
              f"No hay la cantidad suficiente de: {product.name}: {item_data.quantity_m3}, "
              f"disponible {sellable}"
          )
      
      item_subtotal = product.price * item_data.quantity_m3
      item_tax = item_subtotal * product.tax_rate
      subtotal += item_subtotal
      tax += item_tax

      order_item = OrderItem(
          order_id=new_order.id,
          product_id=item_data.product_id,
          quantity_m3=item_data.quantity_m3,
          unit_price=product.price,
          subtotal=item_subtotal
      )

      register_order_deduction(db, product, new_order.id, item_data.quantity_m3, current_user)

      db.add(order_item)

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
  
  if db.query(Payment).filter(Payment.order_id == order.id).first():
    raise ValueError("No se puede editar un pedido que ya tiene proforma de pago")
  
  # Se borran los items existentes (el pedido sigue en 'created', no hay documentos que dependan de ellos)
  db.query(OrderItem).filter(OrderItem.order_id == order.id).delete()

  # Revierte el inventario con movimientos nuevos, sin borrar el historial
  _reverse_order_deductions(db, order, current_user)

  db.flush()

  subtotal = Decimal("0")
  tax = Decimal("0")

  for item_data in order_data.items:
    product = db.query(Product).filter(Product.id == item_data.product_id).first()

    if not product:
      raise ValueError(f"Product with id {item_data.product_id} not found")
    
    if not product.is_active:
      raise ValueError(f"Product with id {item_data.product_id} is not active")

    sellable = get_sellable_stock(db, product)

    if item_data.quantity_m3 > sellable:
      raise ValueError(
        f"Insufficient stock for {product.name}: requested {item_data.quantity_m3}, available {sellable}"
      )
    
    item_subtotal = product.price * item_data.quantity_m3
    item_tax = item_subtotal * product.tax_rate
    subtotal += item_subtotal
    tax += item_tax
    
    order_item = OrderItem(
      order_id=order.id,
      product_id=item_data.product_id,
      quantity_m3=item_data.quantity_m3,
      unit_price=product.price,
      subtotal=item_subtotal
    )
    
    db.add(order_item)

    register_order_deduction(db, product, order.id, item_data.quantity_m3, current_user)

  order.subtotal = subtotal
  order.tax = tax
  order.total = subtotal + tax
  
  db.commit()
  db.refresh(order)
  
  return order


# Calcula para cada pedido, si la persona que lo mira tiene algo que hacer y le añade el resultado al pedido como un campo needs_action (V o F).
# Esto es lo que alimenta la marca "Acción", el contador "N requiere atención" y el botón "Pendientes primero".
# Sirve cuando requiere acción para el pago o el transporte
def attach_needs_action(db: Session, orders: List[Order], current_user: User) -> List[Order]:
  role = current_user.role
  ids = [o.id for o in orders]

  payments, assignments = {}, {}
  if ids:

    # Trae todos los pagos de la lista en una sola consulta y los guarda en un dict cuya llave es el id del pedido. Igual en transporte.
    payments = {p.order_id: p for p in db.query(Payment).filter(Payment.order_id.in_(ids)).all()}

    # Ordenados por fecha: si hay varios por pedido, queda el más reciente
    assignments = {
      a.order_id: a
      for a in db.query(Assignment).filter(Assignment.order_id.in_(ids)).order_by(Assignment.created_at).all()
    }

  # Recorre cada pedido y toma su pago y su transporte del diccionario (None si no existen)
  for order in orders:
    payment = payments.get(order.id)
    assignment = assignments.get(order.id)
    needs = False

    # Decide según el rol de quien consulta:

    # Si es cartera, hay un pago pendiente que ya tiene comprobante, o sea que toca revisarlo.
    if role in ("cartera", "admin"):
      needs = bool(payment and payment.status == "pending" and payment.receipt_url)

    # Si es logistica, hay un transporte pendiente por validar, o el pedido ya tiene el transporte validado y falta generar la guía.
    elif role in ("logistica", "admin"):
      needs = bool(
        (assignment and assignment.validation_status == "pending")
        or order.status == "transport_validated"   # falta generar la guía
      )

    # Si es cliente, faltaría generar la proforma, el pago fue rechazado, falta subir el comprobante, o falta enviar el transporte o lo rechazaron.
    elif role in CLIENT_ROLES:
      if order.status == "created":
        needs = (
          payment is None
          or payment.status == "failed"
          or (payment.status == "pending" and not payment.receipt_url)
        )
      elif order.status == "payment_confirmed":
        needs = assignment is None or assignment.validation_status == "rejected"

    # Le asigna el resultado al objeto del pedido, needs_action no es una columna en la BD, sino un atributo temporal que existe solo durante esa petición
    order.needs_action = needs

  return orders