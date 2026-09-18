from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.schemas.material import MaterialCreate, MaterialResponse
from app.constants.roles import CAN_MANAGE_CATALOG
from app.services.material_service import (
    create_material, edit_material, get_materials, get_material_by_id,
    deactivate_material,
)


router = APIRouter(prefix="/materials", tags=["Materials"])


@router.get("/", response_model=list[MaterialResponse])
def list_materials(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_materials(db)


@router.get("/{material_id}", response_model=MaterialResponse)
def get_material(
    material_id: UUID, 
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    material = get_material_by_id(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.post("/", response_model=MaterialResponse)
def create_new_material(
    material: MaterialCreate, 
    db: Session = Depends(get_db), 
    current_user=Depends(require_role(*CAN_MANAGE_CATALOG)),
):
    return create_material(db, material)


@router.put("/{material_id}", response_model=MaterialResponse)
def update_material(
    material_id: UUID, 
    material: MaterialCreate, 
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_MANAGE_CATALOG)),
):
    updated_material = edit_material(db, material_id, material)
    if not updated_material:
        raise HTTPException(status_code=404, detail="Material not found")
    return updated_material


@router.delete("/{material_id}", response_model=MaterialResponse)
def delete_material(
    material_id: UUID, 
    db: Session = Depends(get_db),
    current_user=Depends(require_role(*CAN_MANAGE_CATALOG)),
):
    deleted_material = deactivate_material(db, material_id)
    if not deleted_material:
        raise HTTPException(status_code=404, detail="Material not found")
    return deleted_material