from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_permission, user_has_permission
from app.schemas.vehicle_type import VehicleTypeCreate, VehicleTypeUpdate, VehicleTypeResponse
from app.services import vehicle_type_service as service

router = APIRouter(prefix="/vehicle-types", tags=["vehicle-types"])


@router.get("/", response_model=list[VehicleTypeResponse])
def list_types(include_inactive: bool = False, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
  # Los inactivos solo los ve quien gestiona; el resto solo ve los activos
  if include_inactive and not user_has_permission(current_user, "vehicle_type:gestionar"):
    include_inactive = False
  return service.list_vehicle_types(db, include_inactive)


@router.post("/", response_model=VehicleTypeResponse, status_code=201)
def create_type(data: VehicleTypeCreate, db: Session = Depends(get_db),
                current_user=Depends(require_permission("vehicle_type:gestionar"))):
  try:
    return service.create_vehicle_type(db, data.name, current_user)
  except ValueError as e:
    db.rollback()
    raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{type_id}", response_model=VehicleTypeResponse)
def update_type(type_id: UUID, data: VehicleTypeUpdate, db: Session = Depends(get_db),
                current_user=Depends(require_permission("vehicle_type:gestionar"))):
  try:
    return service.update_vehicle_type(db, type_id, data.name, data.is_active, current_user)
  except ValueError as e:
    db.rollback()
    raise HTTPException(status_code=400, detail=str(e))