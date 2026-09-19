from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.payment import PaymentConfirmRequest, PaymentCreate, PaymentResponse
from app.services.order_service import can_access_order, get_order_by_id
from app.constants.roles import CAN_VIEW_PAYMENTS_ALL, CAN_CREATE_ORDER, CAN_MANAGE_BANKS_ACCOUNTS, CLIENT_ROLES
from app.services.payment_service import confirm_payment, create_payment, get_payments, get_payment_by_order


router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/", response_model=list[PaymentResponse], summary="Trae todos los pagos")
def get_all_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_PAYMENTS_ALL)),
):
    return get_payments(db)


@router.get("/order/{order_id}", response_model=PaymentResponse, summary="Trae un pago por el id de la orden")
def get_payment_by_order_id(
    order_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_PAYMENTS_ALL)),
):
    order = get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role not in CAN_VIEW_PAYMENTS_ALL and not can_access_order(order, current_user):
        raise HTTPException(status_code=404, detail="Order not found")

    payment = get_payment_by_order(db, order_id)
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found for this order")
    
    return payment


@router.post("/", response_model=PaymentResponse, summary="Crea un nuevo pago")
def create_new_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_CREATE_ORDER)),
):
    order = get_order_by_id(db, data.order_id)

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role != "admin" and not can_access_order(order, current_user):
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        return create_payment(db, data.order_id, data.bank_account_id)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{payment_id}/confirm", response_model=PaymentResponse, summary="Confirma un pago, de manera manual")
def confirm_payment_manually(
    payment_id: UUID,
    data: PaymentConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_BANKS_ACCOUNTS)),
):
    try:
        return confirm_payment(db, payment_id, data.status)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))