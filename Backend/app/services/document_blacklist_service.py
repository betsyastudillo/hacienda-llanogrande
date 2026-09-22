from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.document_blacklist import DocumentBlacklist
from app.models.carrier import Carrier


def get_blacklist(db: Session) -> List[DocumentBlacklist]:
    return db.query(DocumentBlacklist).all()


def is_document_blacklisted(db: Session, document_type: str, document_number: str) -> Optional[DocumentBlacklist]:
    return (
        db.query(DocumentBlacklist)
        .filter(
            DocumentBlacklist.document_type == document_type,
            DocumentBlacklist.document_number == document_number, 
            DocumentBlacklist.is_active == True
        )
        .first()
    )


def blacklist_document(db: Session, document_type: str, document_number: str, reason: str, current_user) -> DocumentBlacklist:
    existing = is_document_blacklisted(db, document_type, document_number)
    if existing:
        raise ValueError("This document is already blacklisted")

    entry = DocumentBlacklist(document_type=document_type, document_number=document_number, reason=reason)
    db.add(entry)

    # Desactiva automáticamente cualquier Carrier existente con ese documento
    carriers = db.query(Carrier).filter(
        Carrier.document_type == document_type,
        Carrier.document_id == document_number
    ).all()
    
    for carrier in carriers:
        carrier.is_active = False

    db.commit()
    db.refresh(entry)
    
    return entry


def remove_from_blacklist(db: Session, blacklist_id: UUID) -> Optional[DocumentBlacklist]:
    entry = db.query(DocumentBlacklist).filter(DocumentBlacklist.id == blacklist_id).first()
    if not entry:
        return None
    entry.is_active = False
    db.commit()
    return entry