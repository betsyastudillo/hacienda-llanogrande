from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import CurrentUser, ProductManager
from app.schemas.product import ProductCreate, ProductResponse
from app.services.product_service import (
    create_product, edit_product, get_products, get_product_by_id,
    deactivate_product,
)


router = APIRouter(prefix="/products", tags=["Productos"])


@router.get("/", response_model=list[ProductResponse], summary="Lista todos los productos")
def list_products(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    return get_products(db)


@router.get("/{product_id}", response_model=ProductResponse, summary="Trae un producto, por id del producto")
def get_product(
    product_id: UUID, 
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductResponse, summary="Crea un producto")
def create_new_product(
    product: ProductCreate, 
    current_user: ProductManager,
    db: Session = Depends(get_db), 
):
    return create_product(db, product)


@router.put("/{product_id}", response_model=ProductResponse, summary="Actualiza un producto")
def update_product(
    product_id: UUID, 
    product: ProductCreate, 
    current_user: ProductManager,
    db: Session = Depends(get_db),
):
    updated_product = edit_product(db, product_id, product)
    if not updated_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return updated_product


@router.delete("/{product_id}", response_model=ProductResponse, summary="Desactiva un producto")
def delete_product(
    product_id: UUID, 
    current_user: ProductManager,
    db: Session = Depends(get_db),
):
    deleted_product = deactivate_product(db, product_id)
   
    if not deleted_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return deleted_product