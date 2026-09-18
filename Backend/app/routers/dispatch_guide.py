from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.dispatch_guide import DispatchGuideCreate, DispatchGuideResponse, VerificationResponse
from app.services.order_service import get_order_by_id, can_access_order
from app.constants.roles import CAN_MANAGE_FLEET, CAN_VIEW_DISPATCH_GUIDES
from app.services.dispatch_guide_service import (
    create_dispatch_guide, get_dispatch_guides, verify_dispatch_guide, get_dispatch_guide_by_order,
)

router = APIRouter(prefix="/dispatch-guides", tags=["Dispatch Guides"])


@router.get("/", response_model=list[DispatchGuideResponse])
def list_dispatch_guides(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_DISPATCH_GUIDES)),
):
    return get_dispatch_guides(db)


@router.get("/order/{order_id}", response_model=DispatchGuideResponse)
def get_guide_by_order_id(
    order_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_DISPATCH_GUIDES)),
):
    order = get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role not in CAN_VIEW_DISPATCH_GUIDES and current_user.role != "soporte" and not can_access_order(order, current_user):
        raise HTTPException(status_code=404, detail="Order not found")

    guide = get_dispatch_guide_by_order(db, order_id)
    
    if not guide:
        raise HTTPException(status_code=404, detail="Dispatch guide not found for this order")
    
    return guide


@router.post("/", response_model=DispatchGuideResponse)
def register_dispatch_guide(
    data: DispatchGuideCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    try:
        return create_dispatch_guide(db, data.order_id)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/verify/{token}", response_model=VerificationResponse)
def verify_guide(token: str, db: Session = Depends(get_db)):
    try:
        return verify_dispatch_guide(db, token)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

