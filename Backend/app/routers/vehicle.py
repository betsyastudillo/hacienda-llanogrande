from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import VehicleManager, VehicleViewer
from app.schemas.document import DocumentBase
from app.schemas.vehicle import VehicleCreate, VehicleResponse
from app.services.document_service import create_document, get_documents_by_vehicle
from app.services.vehicle_service import (
    create_vehicle, get_vehicles, get_vehicle_by_id,
    edit_vehicle, deactivate_vehicle,
)


router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.get("/", response_model=list[VehicleResponse], summary="Lista los vehículos que han sido autorizados para recolección de productos.")
def list_vehicles(
    current_user: VehicleViewer,
    db: Session = Depends(get_db),
):
    return get_vehicles(db)


@router.get("/{vehicle_id}", response_model=VehicleResponse, summary="Trae un vehículo autorizado para la recolección de productos.")
def get_a_vehicle(
    vehicle_id: UUID, 
    current_user: VehicleViewer,
    db: Session = Depends(get_db),
):
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.post("/", response_model=VehicleResponse, summary="Crea un nuevo vehículo. Para guardar registro de los vehículos autorizados para ingresar a la planta.")
def create_new_vehicle(
    vehicle: VehicleCreate, 
    current_user: VehicleManager,
    db: Session = Depends(get_db),
):
    try:
        return create_vehicle(db, vehicle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{vehicle_id}/documents", response_model=DocumentBase, summary="Sube los documentos del vehículo autorizado para ingresar.")
def upload_vehicle_document(
    vehicle_id: UUID,
    current_user: VehicleManager,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return create_document(db, document_type, file, vehicle_id=vehicle_id)


@router.get("/{vehicle_id}/documents", response_model=list[DocumentBase], summary="Lista los documentos del vehículo autorizado para ingresar.")
def list_vehicle_documents(
    vehicle_id: UUID, 
    current_user: VehicleViewer,
    db: Session = Depends(get_db),
):
    return get_documents_by_vehicle(db, vehicle_id)


@router.put("/{vehicle_id}", response_model=VehicleResponse, summary="Actualiza información de un vehículo.")
def update_vehicle(
    vehicle_id: UUID, 
    data: VehicleCreate, 
    current_user: VehicleManager,
    db: Session = Depends(get_db),
):
    try:
        vehicle = edit_vehicle(db, vehicle_id, data)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return vehicle


@router.delete("/{vehicle_id}", summary="Desactiva un vehículo.")
def remove_vehicle(
    vehicle_id: UUID, 
    current_user: VehicleManager,
    db: Session = Depends(get_db),
):
    vehicle = deactivate_vehicle(db, vehicle_id)
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return {"detail": "Vehicle deactivated"}