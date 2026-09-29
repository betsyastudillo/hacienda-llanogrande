from typing import Optional, List
from datetime import date, datetime, time, timedelta
from uuid import UUID
from decimal import ROUND_DOWN, Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from zoneinfo import ZoneInfo
from app.models.inventory_movement import InventoryMovement
from app.models.product import Product

LOCAL_TZ = ZoneInfo("America/Bogota")
ADJUSTMENT_CATEGORIES = ("damage", "count_difference", "other")

# Trae el inventario
def get_current_stock(db: Session, product_id: UUID) -> Decimal:
  def total_for(movement_type: str) -> Decimal:
    result = (
      # coalesce: función de SQL que dice: si este valor es NULL, usa este otro valor en su lugar.
      # Si no hay movimientos de entrada de X producto, garantiza que el resultado sea 0 y no NULL.
      db.query(func.coalesce(func.sum(InventoryMovement.quantity), 0))
      .filter(InventoryMovement.product_id == product_id, InventoryMovement.movement_type == movement_type)
      .scalar()
    )
    return Decimal(result)

  return total_for("entrada") - total_for("salida") + total_for("ajuste")


# Si el producto es un paquete, devuelve su producto base donde realmente vive el inventario, si no, se devuelve a si mismo 
def resolve_stock_target(product: Product) -> Product:
  return product.parent_product if product.parent_product_id else product


# Convierte los paqetes/unidades que pide el cliente a las und a descontar del inventario del producto base.
def get_deduction_quantity(product: Product, quantity_ordered: int) -> int:

  if product.parent_product_id:
    raw = Decimal(quantity_ordered) * product.units_per_pack
    
    if raw != raw.to_integral_value():
      raise ValueError(
        f"El descuento resultante ({raw}) no es un número entero — "
        f"revisa units_per_pack de {product.name}"
      )
    return int(raw)
  
  return quantity_ordered


# Trae los movimientos que ha tenido un producto
def get_movements_by_product(db: Session, product_id: UUID) -> List[InventoryMovement]:
  return (
    db.query(InventoryMovement)
    .filter(InventoryMovement.product_id == product_id)
    .order_by(InventoryMovement.created_at.desc())
    .all()
  )


# Crea un movimiento
def create_manual_movement(
  db: Session, product_id: UUID, movement_type: str, quantity: int, reason: Optional[str], category: Optional[str], current_user
) -> InventoryMovement:

  product = db.query(Product).filter(Product.id == product_id).first()
  
  if not product:
      raise ValueError("Product not found")

  if product.parent_product_id:
      raise ValueError("No se pueden registrar movimientos manuales sobre un paquete — usa el producto base")
  
  if movement_type == "entrada":
    if quantity <= 0:
      raise ValueError("La cantidad de entrada debe ser positiva")
    
    category = None
  
  if movement_type == "ajuste":
    if quantity == 0:
      raise ValueError("El ajuste no puede ser cero")
    
    if category not in ADJUSTMENT_CATEGORIES:
      raise ValueError(f"El ajuste requiere una categoría válida: {ADJUSTMENT_CATEGORIES}")

    if category == "damage":
      quantity = -abs(quantity) # Aquí, el usuario escribe cuántas unds se dañaron

  movement = InventoryMovement(
      product_id=product_id,
      movement_type=movement_type,
      quantity=quantity,
      reason=reason,
      category=category,
      created_by_user_id=current_user.id,
  )
  
  db.add(movement)
  db.commit()
  db.refresh(movement)
  
  return movement


# Cosechas del día
def _period_bounds(start_date: date, end_date: date):
  # Los cortes de día se calculan en hora de Colombia, no en UTC
  start_dt = datetime.combine(start_date, time.min, tzinfo=LOCAL_TZ)
  end_dt = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=LOCAL_TZ)

  return start_dt, end_dt


def _sum_movements(db: Session, product_id: UUID, movement_type: str, start_dt=None, end_dt=None, only_damage=None) -> int:
  query = db.query(func.coalesce(func.sum(InventoryMovement.quantity), 0)).filter(
    InventoryMovement.product_id == product_id,
    InventoryMovement.movement_type == movement_type,
  )

  if start_dt is not None:
    query = query.filter(InventoryMovement.created_at >= start_dt)

  if end_dt is not None:
    query = query.filter(InventoryMovement.created_at < end_dt)

  if only_damage is True:
    query = query.filter(InventoryMovement.category == "damage")

  elif only_damage is False:
    query = query.filter(or_(InventoryMovement.category.is_(None), InventoryMovement.category != "damage"))

  return int(query.scalar())


def _get_kardex(db: Session, product_id: UUID, start_date: date, end_date: date) -> dict:
  product = db.query(Product).filter(Product.id == product_id).first()

  if not product:
    raise ValueError("Product no found")
  
  if product.parent_product_id:
    raise ValueError("Los paquetes no tienen inventario propio - consulta el producto base")
  
  if start_date > end_date:
    raise ValueError("La fecha incial no puede ser posterior a la final")
  
  start_dt, end_dt = _period_bounds(start_date, end_date)

  # Saldo Inicial = todo lo ocurrido ANTES del periodo.
  opening = (
    _sum_movements(db, product_id, "entrada", end_dt=start_dt)
    -_sum_movements(db, product_id, "salida", end_dt=start_dt)
    +_sum_movements(db, product_id, "ajuste", end_dt=start_dt)
  )

  entries = _sum_movements(db, product_id, "entrada", start_dt, end_dt)
  exits = _sum_movements(db, product_id, "salida", start_dt, end_dt)
  adjustments_damage = _sum_movements(db, product_id, "ajuste", start_dt, end_dt, only_damage=True)
  adjustments_other = _sum_movements(db, product_id, "ajuste", start_dt, end_dt, only_damage=False)

  return {
    "product_id": product_id,
    "start_date": start_date,
    "end_date": end_date,
    "opening_balance": opening,
    "entries": entries,
    "exits": exits,
    "adjustments_damage": adjustments_damage,
    "adjustments_other": adjustments_other,
    "closing_balance": opening + entries - exits + adjustments_damage + adjustments_other,
  }

# Registra la salida de inventario por pedido, resuelve automáticamente que si el product es un paquete lo descuenta del producto base. Se guarda junto a la transacción de create_order, por lo tanto, no hace commit
def register_order_deduction(db: Session, product: Product, order_id: UUID, quantity_ordered: int, current_user) -> InventoryMovement:

    stock_target = resolve_stock_target(product)
    deduction_qty = get_deduction_quantity(product, quantity_ordered)

    reason = "Descuento automático por pedido"

    if product.parent_product_id:
        reason += f"({quantity_ordered} paquete(s) de {product.name})"

    movement = InventoryMovement(
        product_id=stock_target.id,
        order_id=order_id,
        movement_type="salida",
        quantity=deduction_qty,
        reason=reason,
        created_by_user_id=current_user.id if current_user else None,
    )

    db.add(movement)
    
    return movement


# Cuantas unds de este producto específico se pueden vender ahora mismo. Si es un pqt, es el stock base / units_per_pack (redondeado hacia abajo).
def get_sellable_stock(db: Session, product: Product) -> int:

    stock_target = resolve_stock_target(product)
    base_stock = get_current_stock(db, stock_target.id)

    if product.parent_product_id:
        return int((base_stock / product.units_per_pack).to_integral_value(rounding=ROUND_DOWN))

    return int(base_stock)