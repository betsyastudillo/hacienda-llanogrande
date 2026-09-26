from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth_dependencies import UserManager
from app.schemas.magic_link import MagicLinkCreate, MagicLinkResponse, MagicLinkVerifyResponse
from app.services.magic_link_service import create_magic_link, verify_magic_link

router = APIRouter(prefix="/magic-links", tags=["Magic Links"])


@router.post("/", response_model=MagicLinkResponse)
def register_magic_link(
    data: MagicLinkCreate,
    current_user: UserManager,
    db: Session = Depends(get_db),
):
    try:
        return create_magic_link(db, data.user_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/verify/{token}", response_model=MagicLinkVerifyResponse)
def verify(token: str, db: Session = Depends(get_db)):
    # SIN autenticación: es el punto de entrada para alguien que aún no tiene sesión
    try:
        access_token = verify_magic_link(db, token)
        return MagicLinkVerifyResponse(access_token=access_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))