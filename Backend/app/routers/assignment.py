from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.assignment import AssignmentCreate, AssignmentResponse
from app.constants.roles import INTERNAL_ROLES, CAN_MANAGE_FLEET, ALL_ROLES
from app.services.assignment_service import create_assignment, get_assignment_by_order, get_assignments
from app.services.order_service import can_access_order, get_order_by_id


router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.get("/", response_model=list[AssignmentResponse])
def get_list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*INTERNAL_ROLES)),
):
    return get_assignments(db)


@router.get("/order/{order_id}", response_model=AssignmentResponse)
def get_assignment_by_order_id(
    order_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*ALL_ROLES)),
):
    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role not in INTERNAL_ROLES and not can_access_order(order, current_user):
        raise HTTPException(status_code=404, detail="Order not found")

    assignment = get_assignment_by_order(db, order_id)
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found for this order")
    return assignment


@router.post("/", response_model=AssignmentResponse)
def register_assignment(
    data: AssignmentCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    try:
        return create_assignment(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

