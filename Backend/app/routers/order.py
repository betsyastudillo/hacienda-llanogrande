from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse
from app.constants.roles import ALL_ROLES, CAN_CREATE_ORDER
from app.services.order_service import create_order, edit_order, get_orders, get_order_by_id, can_access_order


router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/", response_model=list[OrderResponse])
def list_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALL_ROLES)),
):
    return get_orders(db, current_user)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALL_ROLES)),
):
    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not can_access_order(order, current_user):
        # 404 en vez de 403: no revelamos que el pedido existe si no es suyo
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order


@router.post("/", response_model=OrderResponse)
def create_new_order(
    order: OrderCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_CREATE_ORDER)),
):
    try:
        return create_order(db, order, current_user)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    

@router.put("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: UUID, 
    order: OrderCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_CREATE_ORDER)),
):
    try:
        return edit_order(db, order_id, order, current_user)
    
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
    return updated