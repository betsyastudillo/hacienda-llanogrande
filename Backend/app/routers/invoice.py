import os
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.dependencies import user_has_permission
from app.auth_dependencies import InvoiceIssuer, InvoiceViewerAny
from app.schemas.invoice import InvoiceResponse
from app.services.invoice_service import get_invoice_by_order, get_invoice_by_id
from app.services.order_service import get_order_by_id, can_access_order

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _check_access(db, invoice, current_user):
  order = get_order_by_id(db, invoice.order_id)
  
  if not order or (not user_has_permission(current_user, "invoice:ver") and not can_access_order(order, current_user)):
    raise HTTPException(status_code=404, detail="Invoice not found")


@router.get("/order/{order_id}", response_model=InvoiceResponse, summary="Trae la factura de un pedido")
def get_invoice_of_order(order_id: UUID, current_user: InvoiceViewerAny, db: Session = Depends(get_db)):

  invoice = get_invoice_by_order(db, order_id)
  
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  
  _check_access(db, invoice, current_user)
  
  return invoice


@router.get("/{invoice_id}/{kind}", summary="Descarga el PDF o el XML de la factura")
def download(invoice_id: UUID, kind: str, current_user: InvoiceViewerAny, db: Session = Depends(get_db)):

  if kind not in ("pdf", "xml"):
    raise HTTPException(status_code=404, detail="Not found")

  invoice = get_invoice_by_id(db, invoice_id)
  
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  _check_access(db, invoice, current_user)

  url = invoice.pdf_url if kind == "pdf" else invoice.xml_url
  
  if not url or not os.path.exists(url.lstrip("/")):
    raise HTTPException(status_code=404, detail="File not found")

  media = "application/pdf" if kind == "pdf" else "application/xml"
  
  return FileResponse(url.lstrip("/"), media_type=media, filename=f"{invoice.invoice_number}.{kind}")