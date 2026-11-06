from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload
from app.constants.transport_requirements import compute_missing_documents, is_owner_carrier
from app.models.assignment import Assignment
from app.models.assignment_item import AssignmentItem
from app.models.company import Company
from app.models.document import Document
from app.models.dispatch_guide import DispatchGuide
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_counter import OrderCounter
from app.models.payment import Payment
from app.models.product import Product
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.carrier import Carrier
from app.schemas.order import OrderCreate
from app.services.inventory_service import get_sellable_stock


CLIENT_ROLES = ("cliente_operativo", "cliente_admin")
STAFF_VIEW_ALL_ROLES = ("admin", "soporte")
CANCELLABLE_STATUSES = ("created",)
WITHDRAWAL_ORDER_STATUSES = ("facturado", "partially_dispatched") #Estados de pedido en los que se pueden registrar y mover retiros

# Genera los números de orden PED-2026-0000. Para facilitar las búsquedas.
def generate_order_number(db: Session) -> str:
  # Año en hora de Colombia (UTC-5)
  """Genera el número PED-AAAA-NNNN con un contador anual atómico (el año se toma en hora de Colombia)."""
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


# Cantidades por producto del pedido: asignadas a retiros activos y ya despachadas (guía usada)
def get_item_quantities(db: Session, order_id: UUID):
  """Devuelve (asignado, despachado): diccionarios order_item_id -> cantidad.

  Asignado = suma de retiros no anulados; despachado = los retiros cuya guía ya fue usada (salida de portería).
  """
  rows = (
    db.query(AssignmentItem.order_item_id, AssignmentItem.quantity, DispatchGuide.status)
    .join(Assignment, Assignment.id == AssignmentItem.assignment_id)
    .outerjoin(DispatchGuide, DispatchGuide.assignment_id == Assignment.id)
    .filter(Assignment.order_id == order_id, Assignment.cancelled_at.is_(None))
    .all()
  )

  assigned, dispatched = {}, {}

  for order_item_id, quantity, guide_status in rows:
    assigned[order_item_id] = assigned.get(order_item_id, 0) + quantity

    if guide_status == "used":
      dispatched[order_item_id] = dispatched.get(order_item_id, 0) + quantity

  return assigned, dispatched


# Atributos temporales con el saldo de cada producto, para el detalle del pedido
def attach_item_balances(db: Session, order: Order) -> Order:
  """Agrega a cada ítem los atributos temporales assigned_quantity, dispatched_quantity y pending_quantity."""
  assigned, dispatched = get_item_quantities(db, order.id)

  for item in order.items:
    item.assigned_quantity = assigned.get(item.id, 0)
    item.dispatched_quantity = dispatched.get(item.id, 0)
    item.pending_quantity = item.quantity_m3 - item.assigned_quantity

  return order


def get_orders(db: Session, current_user: User) -> List[Order]:
  """Lista pedidos, más recientes primero, según el rol: cliente_admin ve su empresa, cliente_operativo los que creó y el resto todos."""
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
  """Busca un pedido (con su empresa) por id; None si no existe."""
  return db.query(Order).options(joinedload(Order.company)).filter(Order.id == order_id).first()


def can_access_order(order: Order, current_user: User) -> bool:
  """Indica si el usuario puede ver el pedido. Si no puede, el router debe responder 404 (no 403)."""
  if current_user.role in STAFF_VIEW_ALL_ROLES:
    return True
  
  if current_user.role == "cliente_admin":
    return order.company_id == current_user.company_id
  
  if current_user.role == "cliente_operativo":
    return order.created_by_user_id == current_user.id
  
  return True


def _resolve_company_id(order: OrderCreate, current_user: User) -> UUID:
  """Determina la empresa del pedido: la del cliente, o la indicada si lo crea un admin."""
  if current_user.role in CLIENT_ROLES:
    return current_user.company_id  # se ignora cualquier company_id que venga en el payload

  if current_user.role == "admin":
    if not order.company_id:
      raise ValueError("company_id is required when an admin creates an order on behalf of a client")
    return order.company_id

  raise ValueError("This role is not allowed to create orders")


def create_order(db: Session, order: OrderCreate, current_user: User) -> Order:

  """Crea el pedido con sus ítems.

  Valida empresa activa y aprobada, productos activos y stock vendible; congela precios e IVA. Hace commit.
  """
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

      db.add(order_item)

  new_order.subtotal = subtotal
  new_order.tax = tax
  new_order.total = subtotal + tax
  db.commit()
  db.refresh(new_order)
  
  return new_order


def edit_order(db: Session, order_id: UUID, order_data: OrderCreate, current_user: User) -> Optional[Order]:

  """Reemplaza los ítems de un pedido. Solo en estado 'created' y sin proforma. Lanza PermissionError si no tiene acceso."""
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

  order.subtotal = subtotal
  order.tax = tax
  order.total = subtotal + tax
  
  db.commit()
  db.refresh(order)
  
  return order


def cancel_order(db: Session, order_id: UUID, reason: str, current_user) -> Optional[Order]:
  """Anula un pedido (solo en 'created') con motivo obligatorio; un pago pendiente pasa a 'cancelled'."""
  order = get_order_by_id(db, order_id)
  
  if not order:
    return None
  
  if order.status == "cancelled":
    raise ValueError("El pedido ya está anulado")
  
  if order.status not in CANCELLABLE_STATUSES:
    raise ValueError("Solo se pueden anular pedidos que aún no tienen el pago confirmado")

  reason = (reason or "").strip()
  if not reason:
    raise ValueError("El motivo de la anulación es obligatorio")

  payment = db.query(Payment).filter(Payment.order_id == order.id).first()
  
  if payment and payment.status == "pending" and payment.receipt_url:
    raise ValueError("El cliente ya subió un comprobante: confirma o rechaza el pago antes de anular el pedido")
  
  if payment and payment.status == "pending":
    payment.status = "cancelled"

  order.status = "cancelled"
  order.cancelled_at = datetime.now(timezone.utc)
  order.cancelled_by_user_id = current_user.id
  order.cancellation_reason = reason
  order.updated_by_user_id = current_user.id

  db.commit()
  db.refresh(order)
  
  return order


# Calcula para cada pedido, si la persona que lo mira tiene algo que hacer y le añade el resultado al pedido como un campo needs_action (V o F).
# Esto es lo que alimenta la marca "Acción", el contador "N requiere atención" y el botón "Pendientes primero".
# Sirve cuando requiere acción para el pago o el transporte
def attach_needs_action(db: Session, orders: List[Order], current_user: User) -> List[Order]:
  
  """Marca cada pedido con needs_action (True/False) según lo que le toque hacer al usuario por su rol."""
  payments, retiros_by_order, transport_documents = {}, {}, []
  vehicles, carriers = {}, {}
  guided, ordered_totals, assigned_totals = set(), {}, {}

  role = current_user.role
  ids = [o.id for o in orders]

  if ids:

    payments = {p.order_id: p for p in db.query(Payment).filter(Payment.order_id.in_(ids)).all()}

    # Retiros activos (no anulados) de cada retiro
    active = (
      db.query(Assignment)
      .filter(Assignment.order_id.in_(ids), Assignment.cancelled_at.is_(None))
      .order_by(Assignment.sequence)
      .all()
    )

    for a in active:
      retiros_by_order.setdefault(a.order_id, []).append(a)

    # Retiros que ya tienen guía
    guided = {row[0] for row in db.query(DispatchGuide.assignment_id).filter(DispatchGuide.order_id.in_(ids)).all()}

    #Totales para saber si queda algo por programar (si lo pedido supera lo asignado)
    ordered_totals = dict(
      db.query(OrderItem.order_id, func.sum(OrderItem.quantity_m3))
      .filter(OrderItem.order_id.in_(ids))
      .group_by(OrderItem.order_id)
      .all()
    )

    assigned_totals = dict(
      db.query(Assignment.order_id, func.sum(AssignmentItem.quantity))
      .join(AssignmentItem, AssignmentItem.assignment_id == Assignment.id)
      .filter(Assignment.order_id.in_(ids), Assignment.cancelled_at.is_(None))
      .group_by(Assignment.order_id)
      .all()
    )

    if active:
      # Documentos de los vehículos y transportadores de cada asignación
      vehicle_ids = {a.vehicle_id for a in active}
      carrier_ids = {a.carrier_id for a in active}

      vehicles = {v.id: v for v in db.query(Vehicle).filter(Vehicle.id.in_(vehicle_ids)).all()}
      carriers = {c.id: c for c in db.query(Carrier).filter(Carrier.id.in_(carrier_ids)).all()}

      transport_documents = (
        db.query(Document)
        .filter(or_(Document.vehicle_id.in_(vehicle_ids), Document.carrier_id.in_(carrier_ids)))
        .all()
      )
  
  # Un retiro pendiente solo se puede revisar cuando ya están todos los documentos obligatorios
  def docs_missing(a: Assignment) -> bool:
    return bool(compute_missing_documents(
        a.vehicle_id, a.carrier_id, transport_documents,
        is_owner_carrier(vehicles.get(a.vehicle_id), carriers.get(a.carrier_id))
      )
    )

  # Recorre cada pedido y toma su pago y su transporte del diccionario (None si no existen)
  for order in orders:

    if order.status == "cancelled":
      order.needs_action = False
      continue

    payment = payments.get(order.id)
    retiros = retiros_by_order.get(order.id, [])
    in_withdrawal = order.status in WITHDRAWAL_ORDER_STATUSES
    needs = False

    # Catera: si hay un pago pendiente con comprobante, toca revisarlo
    if role in ("cartera", "admin"):
      needs = bool(payment and payment.status == "pending" and payment.receipt_url)

    # Logistica: si hay un retiro pendiente por validar (con sus documentos completos), un retiro aprobado o un cambio de transporte con revisión pendiente
    if role in ("logistica", "admin"):
      needs = needs or any(
        (in_withdrawal and a.validation_status == "pending" and not docs_missing(a))
        or (in_withdrawal and a.validation_status == "approved" and a.id not in guided)
        or a.review_pending
        for a in retiros
      )

    #Cliente: falta generar la proforma / subir el comprobante o hay algo por programar, corregir o completar en los retiros
    if role in CLIENT_ROLES:
      if order.status == "created":
        needs = (
          payment is None
          or payment.status == "failed"
          or (payment.status == "pending" and not payment.receipt_url)
        )
      elif in_withdrawal:
        pending_total = int(ordered_totals.get(order.id, 0)) - int(assigned_totals.get(order.id, 0))
        needs = pending_total > 0 or any(
          a.validation_status == "rejected"
          or (a.validation_status == "pending" and docs_missing(a))
          for a in retiros
        )
    
    order.needs_action = needs
    
  return orders