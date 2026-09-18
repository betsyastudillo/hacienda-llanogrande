from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import require_role, verify_webhook_secret
from app.models.user import User
from app.schemas.payment import PaymentInitiateRequest, PaymentResponse, WebhookRequest
from app.services.order_service import can_access_order, get_order_by_id
from app.constants.roles import CAN_VIEW_PAYMENTS_ALL, CAN_CREATE_ORDER
from app.services.payment_service import get_payments, initiate_payment, confirm_payment_webhook, get_payment_by_order


router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/", response_model=PaymentResponse)
def get_all_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_PAYMENTS_ALL)),
):
    return get_payments(db)


@router.get("/order/{order_id}", response_model=PaymentResponse)
def get_payment_by_order_id(
    order_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_PAYMENTS_ALL, "cliente_admin", "cliente_operativo")),
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


@router.post("/initiate", response_model=PaymentResponse)
def start_payment(
    data: PaymentInitiateRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_CREATE_ORDER)),
):
    order = get_order_by_id(db, data.order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role != "admin" and not can_access_order(order, current_user):
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        return initiate_payment(db, data.order_id)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook", response_model=PaymentResponse, dependencies=[Depends(verify_webhook_secret)])
def bank_webhook(data: WebhookRequest, db: Session = Depends(get_db)):
    try:
        return confirm_payment_webhook(db, data.bank_reference, data.status)
    
    except ValueError as e:

        raise HTTPException(status_code=400, detail=str(e))

