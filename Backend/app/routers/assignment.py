from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.services.order_service import can_access_order, get_order_by_id
from app.dependencies import user_has_permission
from app.auth_dependencies import (
    AssignmentValidator, AssignmentViewer, AssignmentViewerAny,
    AssignmentCreatorOwn,
)
from app.schemas.assignment import (
    AssignmentCreate, AssignmentResubmit, AssignmentValidateRequest, AssignmentResponse,
)
from app.services.assignment_service import (
    create_assignment, resubmit_assignment, validate_assignment,
    get_assignment_by_order, get_assignments,
)

router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.get("/", response_model=list[AssignmentResponse], summary="Lista todas las asignaciones.")
def get_list_assignments(
    current_user: AssignmentViewer,
    db: Session = Depends(get_db),
):
    return get_assignments(db)


@router.get("/order/{order_id}", response_model=AssignmentResponse, summary="Trae una asignación por id de la orden")
def get_assignment_by_order_id(
    order_id: UUID,
    current_user: AssignmentViewerAny,
    db: Session = Depends(get_db),
):
    order = get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Si no tiene permiso:
    if not user_has_permission(current_user, "assignment:ver") and not can_access_order(order, current_user):
        raise HTTPException(status_code=404, detail="Order not found")

    assignment = get_assignment_by_order(db, order_id)
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found for this order")
    
    return assignment


@router.post("/", response_model=AssignmentResponse, summary="Registra una asignación")
def register_assignment(
    data: AssignmentCreate,
    current_user: AssignmentCreatorOwn,
    db: Session = Depends(get_db),
):
    try:
        return create_assignment(db, data, current_user)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/order/{order_id}/resubmit", response_model=AssignmentResponse, summary="Reenvío de información si se rechazó vehículo o transportador.")
def resubmit(
    order_id: UUID,
    data: AssignmentResubmit,
    current_user: AssignmentCreatorOwn,
    db: Session = Depends(get_db),
):
    try:
        return resubmit_assignment(db, order_id, data.vehicle, data.carrier, current_user)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{assignment_id}/validate", response_model=AssignmentResponse, summary="Validación de la asignación")
def validate(
    assignment_id: UUID,
    data: AssignmentValidateRequest,
    current_user: AssignmentValidator,
    db: Session = Depends(get_db),
):
    try:
        return validate_assignment(
            db, assignment_id, data.decision, data.rejection_reason,
            data.background_check_verified, data.blacklist_carrier, current_user,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))