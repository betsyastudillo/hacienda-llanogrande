from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserResponse, LoginRequest, TokenResponse
from app.auth_dependencies import UserManager
from app.services.user_service import create_user, authenticate_user
from app.services.auth_service import create_access_token
from app.models.company import Company


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, summary="Registrar un usuario, solo lo puede hacer admin")
def register_user(
    user_create: UserCreate,
    current_user: UserManager,
    db: Session = Depends(get_db),
):
    return create_user(db, user_create)


@router.post("/login", response_model=TokenResponse, summary="Inicio de sesión")
def login_user(login_request: LoginRequest, db: Session = Depends(get_db)):
  user = authenticate_user(db, login_request.document_id, login_request.password)
  
  if not user:
    raise HTTPException(status_code=401, detail="Invalid document ID or password")
  
  if user.company_id:
    company = db.query(Company).filter(Company.id == user.company_id).first()

    if company and not company.is_active:
      raise HTTPException(
        status_code=403,
        detail="Tu empresa está desactivada. Conecta al administrador"
      )
  access_token = create_access_token({
    "sub": user.document_id,
    "role": user.role,
    "company_id": str(user.company_id)
  })
  
  return TokenResponse(access_token=access_token)