from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import CarrierManager, CarrierViewer
from app.schemas.document import DocumentBase
from app.schemas.carrier import CarrierCreate, CarrierResponse
from app.services.document_service import create_document, get_documents_by_carrier
from app.services.carrier_service import (
    create_carrier, get_carriers, get_carrier_by_id,
    edit_carrier, deactivate_carrier,
)

router = APIRouter(prefix="/carriers", tags=["Carriers"])


@router.get("/", response_model=list[CarrierResponse], summary="Lista los transportadores autorizados para ingreso.")
def list_carriers(
    current_user: CarrierViewer,
    db: Session = Depends(get_db),
):
    return get_carriers(db)


@router.get("/{carrier_id}", response_model=CarrierResponse, summary="Trae la información un transportador")
def get_a_carrier(
    carrier_id: UUID, 
    current_user: CarrierViewer,
    db: Session = Depends(get_db),
):
    carrier = get_carrier_by_id(db, carrier_id)
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    return carrier


@router.post("/", response_model=CarrierResponse, summary="Crear un transportador. Después de la búsqueda en listas vinculantes.")
def create_new_carrier(
    carrier: CarrierCreate, 
    current_user: CarrierManager,
    db: Session = Depends(get_db),
):
    return create_carrier(db, carrier)


@router.post("/{carrier_id}/documents", response_model=DocumentBase, summary="Actualizar los documentos de un transportador.")
def upload_carrier_document(
    carrier_id: UUID,
    current_user: CarrierManager,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return create_document(db, document_type, file, carrier_id=carrier_id)


@router.get("/{carrier_id}/documents", response_model=list[DocumentBase], summary="Lista los documentos del transportador.")
def list_carrier_documents(
    carrier_id: UUID, 
    current_user: CarrierViewer,
    db: Session = Depends(get_db),
):
    return get_documents_by_carrier(db, carrier_id)


@router.put("/{carrier_id}", response_model=CarrierResponse, summary="Actualiza la información de un transportador.")
def update_carrier(
    carrier_id: UUID, 
    data: CarrierCreate, 
    current_user: CarrierManager,
    db: Session = Depends(get_db),
):
    carrier = edit_carrier(db, carrier_id, data)
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    return carrier


@router.delete("/{carrier_id}", summary="Desactiva un transportador.")
def remove_carrier(
    carrier_id: UUID, 
    current_user: CarrierManager,
    db: Session = Depends(get_db),
):
    carrier = deactivate_carrier(db, carrier_id)
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    return {"detail": "Carrier deactivated"}