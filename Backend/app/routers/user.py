from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.auth_dependencies import CurrentUser, UserManager
from app.schemas.user import UserResponse, UserUpdate, UserSelfUpdate, PasswordChangeRequest
from app.services.user_service import (
    get_users, get_user_by_id, update_user, update_own_profile,
    deactivate_user, change_password,
)

router = APIRouter(prefix="/users", tags=["Users"])


# Se colocan con /me para que FastAPI no vaya a interpretarlas como UUID
@router.get("/me", response_model=UserResponse, summary="Trae información del perfil desde donde se inicia sesión")
def get_my_profile(current_user: CurrentUser):
    return current_user


@router.put("/me", response_model=UserResponse, summary="Actualiza el usuario desde donde se inicia sesión")
def update_my_profile(
    data: UserSelfUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    return update_own_profile(db, current_user, data)


@router.patch("/me/password", response_model=UserResponse, summary="Cambio de contraseña")
def change_my_password(
    data: PasswordChangeRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    try:
        return change_password(db, current_user, data)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Rutas de administración, solo admin

@router.get("/", response_model=list[UserResponse], summary="Lista todos los usuarios. Función solo para admin")
def list_users(
    current_user: UserManager,
    db: Session = Depends(get_db),
):
    return get_users(db)


@router.get("/{user_id}", response_model=UserResponse, summary="Trae un usuario. Función solo para admin")
def get_user(
    user_id: UUID,
    current_user: UserManager,
    db: Session = Depends(get_db),
):
    user = get_user_by_id(db, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.put("/{user_id}", response_model=UserResponse, summary="Actualiza un usuario. Función solo para admin")
def edit_user(
    user_id: UUID,
    data: UserUpdate,
    current_user: UserManager,
    db: Session = Depends(get_db),
):
    user = update_user(db, user_id, data)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


# Desactiva al usuario, no lo elimina
@router.delete("/{user_id}", summary="Desactiva un usuario. Función solo para admin")
def remove_user(
    user_id: UUID,
    current_user: UserManager,
    db: Session = Depends(get_db),
):
    user = deactivate_user(db, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"detail": "User deactivated"}