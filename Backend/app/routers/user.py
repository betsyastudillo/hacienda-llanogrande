from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User as UserModel
from app.schemas.user import UserResponse, UserUpdate, UserSelfUpdate, PasswordChangeRequest
from app.constants.roles import CAN_MANAGE_USERS
from app.services.user_service import (
    get_users, get_user_by_id, update_user, update_own_profile,
    deactivate_user, change_password,
)

router = APIRouter(prefix="/users", tags=["Users"])


# Se colocan con /me para que FastAPI no vaya a interpretarlas como UUID
@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: UserModel = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    data: UserSelfUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    return update_own_profile(db, current_user, data)


@router.patch("/me/password", response_model=UserResponse)
def change_my_password(
    data: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    try:
        return change_password(db, current_user, data)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Rutas de administración, solo admin

@router.get("/", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role(CAN_MANAGE_USERS)),
):
    return get_users(db)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role(CAN_MANAGE_USERS)),
):
    user = get_user_by_id(db, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
def edit_user(
    user_id: UUID,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role(CAN_MANAGE_USERS)),
):
    user = update_user(db, user_id, data)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


# Desactiva al usuario, no lo elimina
@router.delete("/{user_id}")
def remove_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role(CAN_MANAGE_USERS)),
):
    user = deactivate_user(db, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"detail": "User deactivated"}