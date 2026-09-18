from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.document import DocumentBase
from app.schemas.vehicle import VehicleCreate, VehicleResponse
from app.services.document_service import create_document, get_documents_by_vehicle
from app.constants.roles import CAN_MANAGE_FLEET, CAN_VIEW_FLEET
from app.services.vehicle_service import (
    create_vehicle, get_vehicles, get_vehicle_by_id,
    edit_vehicle, deactivate_vehicle,
)


router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.get("/", response_model=list[VehicleResponse])
def list_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_FLEET)),
):
    return get_vehicles(db)


@router.get("/{vehicle_id}", response_model=VehicleResponse)
def get_a_vehicle(
    vehicle_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_FLEET)),
):
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.post("/", response_model=VehicleResponse)
def create_new_vehicle(
    vehicle: VehicleCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    try:
        return create_vehicle(db, vehicle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{vehicle_id}/documents", response_model=DocumentBase)
def upload_vehicle_document(
    vehicle_id: UUID,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    return create_document(db, document_type, file, vehicle_id=vehicle_id)


@router.get("/{vehicle_id}/documents", response_model=list[DocumentBase])
def list_vehicle_documents(
    vehicle_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_VIEW_FLEET)),
):
    return get_documents_by_vehicle(db, vehicle_id)


@router.put("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: UUID, 
    data: VehicleCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    try:
        vehicle = edit_vehicle(db, vehicle_id, data)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return vehicle


@router.delete("/{vehicle_id}")
def remove_vehicle(
    vehicle_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*CAN_MANAGE_FLEET)),
):
    vehicle = deactivate_vehicle(db, vehicle_id)
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return {"detail": "Vehicle deactivated"}