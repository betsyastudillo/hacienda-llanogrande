from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.document import DocumentBase
from app.schemas.carrier import CarrierCreate, CarrierResponse
from app.services.document_service import create_document, get_documents_by_carrier
from app.constants.roles import CAN_MANAGE_FLEET, CAN_VIEW_FLEET
from app.services.carrier_service import (
    create_carrier, get_carriers, get_carrier_by_id,
    edit_carrier, deactivate_carrier,
)

router = APIRouter(prefix="/carriers", tags=["Carriers"])


@router.get("/", response_model=list[CarrierResponse])
def list_carriers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_FLEET)),
):
    return get_carriers(db)


@router.get("/{carrier_id}", response_model=CarrierResponse)
def get_a_carrier(
    carrier_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_FLEET)),
):
    carrier = get_carrier_by_id(db, carrier_id)
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    return carrier


@router.post("/", response_model=CarrierResponse)
def create_new_carrier(
    carrier: CarrierCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    return create_carrier(db, carrier)


@router.post("/{carrier_id}/documents", response_model=DocumentBase)
def upload_carrier_document(
    carrier_id: UUID,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    return create_document(db, document_type, file, carrier_id=carrier_id)


@router.get("/{carrier_id}/documents", response_model=list[DocumentBase])
def list_carrier_documents(
    carrier_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_FLEET)),
):
    return get_documents_by_carrier(db, carrier_id)


@router.put("/{carrier_id}", response_model=CarrierResponse)
def update_carrier(
    carrier_id: UUID, 
    data: CarrierCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    carrier = edit_carrier(db, carrier_id, data)
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    return carrier


@router.delete("/{carrier_id}")
def remove_carrier(
    carrier_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    carrier = deactivate_carrier(db, carrier_id)
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    return {"detail": "Carrier deactivated"}