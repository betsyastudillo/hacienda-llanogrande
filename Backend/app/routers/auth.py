from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User as UserModel
from app.schemas.user import UserCreate, UserResponse, LoginRequest, TokenResponse
from app.constants.roles import CAN_MANAGE_USERS
from app.services.user_service import create_user, authenticate_user
from app.services.auth_service import create_access_token


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse)
def register_user(
    user_create: UserCreate, 
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_role(*CAN_MANAGE_USERS)),
):
    return create_user(db, user_create)


@router.post("/login", response_model=TokenResponse)
def login_user(
    login_request: LoginRequest, 
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, login_request.document_id, login_request.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid document ID or password")
    
    access_token = create_access_token({
        "sub": user.document_id,
        "role": user.role,
        "company_id": str(user.company_id)
    })
    return TokenResponse(access_token=access_token)