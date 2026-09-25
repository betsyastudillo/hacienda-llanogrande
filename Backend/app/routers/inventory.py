from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import InventoryManager, InventoryViewer
from app.models.product import Product
from app.schemas.inventory_movement import InventoryMovementCreate, InventoryMovementResponse, StockResponse
from app.services.inventory_service import (
    get_current_stock, get_sellable_stock, get_movements_by_product, create_manual_movement,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/products/{product_id}/stock", response_model=StockResponse)
def get_stock(
    product_id: UUID,
    current_user: InventoryViewer,
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
        return create_manual_movement(db, data.product_id, data.movement_type, data.quantity, data.reason, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))