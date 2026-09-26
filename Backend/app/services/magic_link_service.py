import secrets
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.magic_link import MagicLink
from app.models.user import User
from app.services.auth_service import create_access_token

MAGIC_LINK_EXPIRATION_HOURS = 48


def create_magic_link(db: Session, user_id: UUID, current_user) -> MagicLink:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    if not user.is_active:
        raise ValueError("Cannot generate a magic link for an inactive user")

    if user.role not in ("cliente_admin", "cliente_operativo"):
        raise ValueError("Magic links are only for client roles")

    token = secrets.token_urlsafe(32)

    magic_link = MagicLink(
        user_id=user_id,
        token=token,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(hours=MAGIC_LINK_EXPIRATION_HOURS),
        created_by_user_id=current_user.id,
    )

    db.add(magic_link)
    db.commit()
    db.refresh(magic_link)

    return magic_link


def verify_magic_link(db: Session, token: str) -> str:
    """Valida el token, lo marca como usado, y devuelve un access_token real para el usuario asociado."""
    magic_link = db.query(MagicLink).filter(MagicLink.token == token).first()

    if not magic_link:
        raise ValueError("Invalid token")

    if magic_link.status != "pending":
        raise ValueError("This link has already been used")

    if magic_link.expires_at < datetime.utcnow():
        magic_link.status = "expired"
        db.commit()
        raise ValueError("This link has expired")

    user = db.query(User).filter(User.id == magic_link.user_id).first()
    if not user or not user.is_active:
        raise ValueError("The associated user is no longer active")

    magic_link.status = "used"
    magic_link.used_at = datetime.utcnow()
    db.commit()

    access_token = create_access_token({
        "sub": user.document_id,
        "role": user.role,
        "company_id": str(user.company_id),
    })

    return access_token