from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date
from app.dependencies import user_has_permission
from app.database import get_db
from app.auth_dependencies import InventoryManager, InventoryViewer, StockViewerAny
from app.models.product import Product
from app.schemas.inventory_movement import InventoryMovementCreate, InventoryMovementResponse, KardexResponse, StockResponse
from app.services.inventory_service import (
    _get_kardex, get_current_stock, get_sellable_stock, get_movements_by_product, create_manual_movement,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/products/{product_id}/stock", response_model=StockResponse)
def get_stock(
  product_id: UUID,
  current_user: StockViewerAny,
  db: Session = Depends(get_db),
):
  product = db.query(Product).filter(Product.id == product_id).first()
  if not product:
    raise HTTPException(status_code=404, detail="Product not found")

  return StockResponse(
    product_id=product_id,
    current_stock=get_sellable_stock(db, product),
  )


@router.get("/products/{product_id}/movements", response_model=list[InventoryMovementResponse])
def list_movements(
  product_id: UUID,
  current_user: InventoryViewer,
  db: Session = Depends(get_db),
):
  return get_movements_by_product(db, product_id)


@router.post("/movements", response_model=InventoryMovementResponse)
def register_movement(
  data: InventoryMovementCreate,
  current_user: InventoryManager,
  db: Session = Depends(get_db),
):
  try:
    return create_manual_movement(db, data.product_id, data.movement_type, data.quantity, data.category, data.reason, current_user)
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
  

@router.get("/products/{product_id}/kardex", response_model=KardexResponse)
def product_kardex(
  product_id: UUID,
  start_date: date,
  end_date: date,
  current_user: InventoryViewer,
  db: Session = Depends(get_db),
):
  try:
    return _get_kardex(db, product_id, start_date, end_date)
  
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
  

@router.post("/movements", response_model=InventoryMovementResponse)
def register_movement(
  data: InventoryMovementCreate,
  current_user: InventoryManager,
  db: Session = Depends(get_db),
):
  # Los ajustes son excepcionales: Solo quien tenga el permiso específico (Hoy: admin unicamente)
  if data.movement_type == "ajuste" and not user_has_permission(current_user, "inventory:ajustar"):
      raise HTTPException(status_code=403, detail="Solo un administrador puede registrar ajustes de inventario")

  try:
    return create_manual_movement(
      db, data.product_id, data.movement_type, data.quantity,
      data.reason, data.category, current_user,
    )
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))