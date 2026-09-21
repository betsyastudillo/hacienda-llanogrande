import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import DocumentReviewer, DocumentViewer
from app.schemas.document import DocumentBase, DocumentStatusUpdate
from app.services.document_service import create_document, get_documents_by_company, replace_document_file, update_document_status

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/", response_model=list[DocumentBase], summary="Lista los documentos de una empresa")
def list_documents(
    company_id: UUID, 
    current_user: DocumentViewer,
    db: Session = Depends(get_db),
):
    return get_documents_by_company(db, company_id)


@router.post("/{company_id}", response_model=DocumentBase, summary="Sube los documentos de una empresa (sujeto a revisión).")
def upload_document(
    company_id: UUID,
    current_user: DocumentReviewer,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return create_document(db, document_type, file, company_id=company_id)


@router.patch("/{document_id}/status", response_model=DocumentBase, summary="Cambia el estado de los documentos, de pendiente a aprobado, después de una revisión.")
def change_document_status(
    document_id: UUID,
    status_update: DocumentStatusUpdate,
    current_user: DocumentReviewer,
    db: Session = Depends(get_db),
):
    document = update_document_status(db, document_id, status_update.status)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.put("/{document_id}", response_model=DocumentBase, summary="Actualiza un documento subido.")
def update_document_file(
    document_id: UUID,
    current_user: DocumentReviewer,
    new_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    document = replace_document_file(db, document_id, new_file)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document