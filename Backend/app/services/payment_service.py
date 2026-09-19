import uuid
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.bank_account import BankAccount
from app.models.payment import Payment
from app.models.order import Order


# Trae todos los pagos
def get_payments(db: Session) -> List[Payment]:
    return db.query(Payment).all()


# Trae un pago, por id de la orden
def get_payment_by_order(db: Session, order_id: UUID) -> Optional[Payment]:
    return db.query(Payment).filter(Payment.order_id == order_id).first()


# Trae un pago, por id
def get_payment_by_id(db: Session, payment_id: UUID) -> Optional[Payment]:
    return db.query(Payment).filter(Payment.id == payment_id).first()


# Se genera el número de la factura pro forma
def generate_proforma_number(db: Session) -> str:
    year = datetime.utcnow().year

    prefix = f"PRO-{year}-"

    existing_count = (
        db.query(Payment)
        .filter(Payment.proforma_number.like(f"{prefix}%"))
        .count()
    )

    next_number = existing_count + 1

    return f"{prefix}{next_number:04d}"


def create_payment(db: Session, order_id: UUID, bank_account_id: UUID) -> Payment:

    order = db.query(Order).filter(Order.id == order_id).first()

    if not order:
        raise ValueError("Order not found")
    
    if order.status != "created":
        raise ValueError("Order must be in 'created' status to generate a payment proforma")
    
    existing = db.query(Payment).filter(Payment.order_id == order_id).first()

    if existing:
        raise ValueError("A payment already exists for this order")
    
    bank_account = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()

    if not bank_account or not bank_account.is_active:
        raise ValueError ("Bank account not found or inactive")
    
    new_payment = Payment(
        order_id=order_id,
        bank_account_id=bank_account_id,
        proforma_number=generate_proforma_number(db),
        status="pending",
        amount=order.total,
    )

    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    return new_payment


def confirm_payment(db: Session, payment_id: UUID, status: str) -> Payment:

    payment = get_payment_by_id(db, payment_id)

    if not payment:
        raise ValueError("Payment not found")

    if payment.status != "pending":
        raise ValueError(f"Payment already processed with status: {payment.status}")

    payment.status = status

    if status == "confirmed":
        payment.confirmed_at = datetime.utcnow()
        
        order = db.query(Order).filter(Order.id == payment.order_id).first()
        
        order.status = "payment_confirmed"

    db.commit()
    db.refresh(payment)

    return payment


