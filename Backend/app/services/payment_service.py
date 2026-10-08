import os, uuid, shutil
from fastapi import UploadFile
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.bank_account import BankAccount
from app.models.payment import Payment
from app.models.order import Order
from app.services.proforma_pdf import generate_proforma_pdf, PROFORMAS_DIR


RECEIPTS_DIR = "uploads/receipts"
ALLOWED_RECEIPT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


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


def save_receipt_file(file: UploadFile, payment_id: UUID) -> str:
  extension = os.path.splitext(file.filename or "")[1].lower()

  if extension not in ALLOWED_RECEIPT_EXTENSIONS:
    raise ValueError("Receipt must be a PDF, JPG, PNG or WEBP file")

  # Mide el tamaño sin cargar el archivo completo en memoria
  file.file.seek(0, os.SEEK_END)
  size = file.file.tell()
  file.file.seek(0)

  if size == 0:
    raise ValueError("Receipt file is empty")

  if size > MAX_RECEIPT_SIZE_BYTES:
    raise ValueError("Receipt file must be 5 MB or smaller")

  folder = os.path.join(RECEIPTS_DIR, str(payment_id))
  os.makedirs(folder, exist_ok=True)

  file_path = os.path.join(folder, f"{uuid.uuid4()}{extension}")

  with open(file_path, "wb") as buffer:
    shutil.copyfileobj(file.file, buffer)

  return f"/{file_path}"


# Sube o reemplaza el comprobante. Si el pago estaba rechazado, vuelve a pendiente
def upload_receipt(db: Session, payment_id: UUID, file: UploadFile) -> Payment:

  payment = get_payment_by_id(db, payment_id)

  if not payment:
    raise ValueError("Payment not found")

  if payment.status not in ("pending", "failed"):
    raise ValueError(f"Cannot upload a receipt for a payment with status: {payment.status}")

  old_path = payment.receipt_url.lstrip("/") if payment.receipt_url else None

  payment.receipt_url = save_receipt_file(file, payment.id)
  payment.receipt_uploaded_at = datetime.utcnow()
  payment.status = "pending"
  payment.rejection_reason = None

  db.commit()
  db.refresh(payment)

  # El archivo viejo se borra solo cuando el cambio ya quedó guardado
  if old_path and os.path.exists(old_path):
    os.remove(old_path)

  return payment


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
  db.flush()  # asigna el id sin confirmar todavía
  payment_id = new_payment.id

  try:
    new_payment.pdf_url = generate_proforma_pdf(db, new_payment, order, bank_account)
    db.commit()
  
  except Exception:
    # Si falla el PDF no queda pago a medias ni archivo suelto
    db.rollback()
    shutil.rmtree(os.path.join(PROFORMAS_DIR, str(payment_id)), ignore_errors=True)
  
    raise

  db.refresh(new_payment)
  
  return new_payment


def confirm_payment(
  db: Session,
  payment_id: UUID,
  status: str,
  reason: Optional[str] = None,
) -> Payment:

  payment = get_payment_by_id(db, payment_id)

  if not payment:
    raise ValueError("Payment not found")

  if payment.status != "pending":
    raise ValueError(f"Payment already processed with status: {payment.status}")

  order = db.query(Order).filter(Order.id == payment.order_id).first()

  if not order:
    raise ValueError("Order not found")

  if order.status != "created":
    raise ValueError("Order must be in 'created' status to process its payment")

  if status == "confirmed":
    if not payment.receipt_url:
      raise ValueError("A receipt must be uploaded before confirming the payment")

    payment.status = "confirmed"
    payment.confirmed_at = datetime.utcnow()
    payment.rejection_reason = None
    order.status = "payment_confirmed"

  else:
    if not reason or not reason.strip():
      raise ValueError("A reason is required when rejecting a payment")

    payment.status = "failed"
    payment.rejection_reason = reason.strip()

  db.commit()
  db.refresh(payment)

  return payment


