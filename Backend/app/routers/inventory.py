from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import InventoryManager, InventoryViewer
from app.models.material import Material
from app.schemas.inventory_movement import InventoryMovementCreate, InventoryMovementResponse, StockResponse
from app.services.inventory_service import (
    get_current_stock, get_sellable_stock, get_movements_by_product, create_manual_movement,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/materials/{material_id}/stock", response_model=StockResponse)
def get_stock(
    material_id: UUID,
    current_user: InventoryViewer,
    db: Session = Depends(get_db),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    return StockResponse(
        material_id=material_id,
        current_stock=get_sellable_stock(db, material),
    )


@router.get("/materials/{material_id}/movements", response_model=list[InventoryMovementResponse])
def list_movements(
    material_id: UUID,
    current_user: InventoryViewer,
    db: Session = Depends(get_db),
):
    return get_movements_by_product(db, material_id)


@router.post("/movements", response_model=InventoryMovementResponse)
def register_movement(
    data: InventoryMovementCreate,
    current_user: InventoryManager,
    db: Session = Depends(get_db),
):
    try:
        return create_manual_movement(db, data.material_id, data.movement_type, data.quantity, data.reason, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))