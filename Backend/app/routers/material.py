from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import CurrentUser, ProductManager
from app.schemas.material import MaterialCreate, MaterialResponse
from app.services.material_service import (
    create_material, edit_material, get_materials, get_material_by_id,
    deactivate_material,
)


router = APIRouter(prefix="/materials", tags=["Materials"])


@router.get("/", response_model=list[MaterialResponse], summary="Lista todos los productos")
def list_materials(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    return get_materials(db)


@router.get("/{material_id}", response_model=MaterialResponse, summary="Trae un producto, por id del producto")
def get_material(
    material_id: UUID, 
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    material = get_material_by_id(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.post("/", response_model=MaterialResponse, summary="Crea un producto")
def create_new_material(
    material: MaterialCreate, 
    current_user: ProductManager,
    db: Session = Depends(get_db), 
):
    return create_material(db, material)


@router.put("/{material_id}", response_model=MaterialResponse, summary="Actualiza un producto")
def update_material(
    material_id: UUID, 
    material: MaterialCreate, 
    current_user: ProductManager,
    db: Session = Depends(get_db),
):
    updated_material = edit_material(db, material_id, material)
    if not updated_material:
        raise HTTPException(status_code=404, detail="Material not found")
    return updated_material


@router.delete("/{material_id}", response_model=MaterialResponse, summary="Desactiva un producto")
def delete_material(
    material_id: UUID, 
    current_user: ProductManager,
    db: Session = Depends(get_db),
):
    deleted_material = deactivate_material(db, material_id)
    if not deleted_material:
        raise HTTPException(status_code=404, detail="Material not found")
    return deleted_material