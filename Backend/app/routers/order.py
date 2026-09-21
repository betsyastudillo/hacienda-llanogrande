from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import OrderCreator, OrderViewerAny
from app.schemas.order import OrderCreate, OrderResponse
from app.services.order_service import create_order, edit_order, get_orders, get_order_by_id, can_access_order


router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/", response_model=list[OrderResponse], summary="Lista todas las ordenes")
def list_orders(
    current_user: OrderViewerAny,
    db: Session = Depends(get_db),
):
    return get_orders(db, current_user)


@router.get("/{order_id}", response_model=OrderResponse, summary="Trae una orden por id de la orden")
def get_order(
    order_id: UUID, 
    current_user: OrderViewerAny,
    db: Session = Depends(get_db),
):
    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not can_access_order(order, current_user):
        # 404 en vez de 403: no revelamos que el pedido existe si no es suyo
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order


@router.post("/", response_model=OrderResponse, summary="Crea una orden")
def create_new_order(
    order: OrderCreate, 
    current_user: OrderCreator,
    db: Session = Depends(get_db),
):
    try:
        return create_order(db, order, current_user)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    

@router.put("/{order_id}", response_model=OrderResponse, summary="Actualiza una orden")
def update_order(
    order_id: UUID, 
    order: OrderCreate, 
    current_user: OrderCreator,
    db: Session = Depends(get_db),
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