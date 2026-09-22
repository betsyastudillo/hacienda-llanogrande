from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import BlacklistManager
from app.schemas.document_blacklist import DocumentBlacklistCreate, DocumentBlacklistResponse
from app.services.document_blacklist_service import (
    get_blacklist, blacklist_document, remove_from_blacklist,
)

router = APIRouter(prefix="/document-blacklist", tags=["Document Blacklist"])


@router.get("/", response_model=list[DocumentBlacklistResponse])
def list_blacklist(
    current_user: BlacklistManager,
    db: Session = Depends(get_db),
):
    return get_blacklist(db)


@router.post("/", response_model=DocumentBlacklistResponse)
def create_blacklist_entry(
    data: DocumentBlacklistCreate,
    current_user: BlacklistManager,
    db: Session = Depends(get_db),
):
    try:
        return blacklist_document(db, data.document_number, data.reason, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{blacklist_id}")
def remove_blacklist_entry(
    blacklist_id: UUID,
    current_user: BlacklistManager,
    db: Session = Depends(get_db),
):
    entry = remove_from_blacklist(db, blacklist_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Blacklist entry not found")
    return {"detail": "Document removed from blacklist"}