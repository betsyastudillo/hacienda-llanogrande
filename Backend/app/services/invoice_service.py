import os, uuid, shutil
from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.models.invoice import Invoice

INVOICES_DIR = "uploads/invoices"
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def get_invoice_by_order(db: Session, order_id: UUID) -> Optional[Invoice]:
  return db.query(Invoice).filter(Invoice.order_id == order_id).first()


def get_invoice_by_id(db: Session, invoice_id: UUID) -> Optional[Invoice]:
  return db.query(Invoice).filter(Invoice.id == invoice_id).first()