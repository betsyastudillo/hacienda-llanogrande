import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import require_role
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentBase, DocumentStatusUpdate
from app.constants.roles import CAN_REVIEW_DOCUMENTS, CAN_VIEW_DOCUMENTS
from app.services.document_service import create_document, get_documents_by_company, replace_document_file, save_document_file, update_document_status

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/", response_model=list[DocumentBase])
def list_documents(
    company_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_DOCUMENTS)),
):
    return get_documents_by_company(db, company_id)


@router.post("/{company_id}", response_model=DocumentBase)
def upload_document(
    company_id: UUID,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_REVIEW_DOCUMENTS)),
):
    return create_document(db, document_type, file, company_id=company_id)


@router.patch("/{document_id}/status", response_model=DocumentBase)
def change_document_status(
    document_id: UUID,
    status_update: DocumentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_REVIEW_DOCUMENTS)),
):
    document = update_document_status(db, document_id, status_update.status)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.put("/{document_id}", response_model=DocumentBase)
def update_document_file(
    document_id: UUID,
    new_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_REVIEW_DOCUMENTS)),
):
    document = replace_document_file(db, document_id, new_file)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document