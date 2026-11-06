from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import PasswordChangeRequest, UserCreate, UserSelfUpdate, UserUpdate
from app.services.auth_service import hash_password, verify_password


def get_users(db: Session) -> List[User]:
    """Lista todos los usuarios."""
    return db.query(User).all()


def get_user_by_document_id(db: Session, document_id: str) -> Optional[User]:
    """Busca un usuario por su documento (que es el nombre de usuario de login)."""
    return db.query(User).filter(User.document_id == document_id).first()


def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
    """Busca un usuario por su id."""
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, document_id: str, password: str) -> Optional[User]:
    """Devuelve el usuario si el documento y la contraseña son correctos; si no, None."""
    user = get_user_by_document_id(db, document_id)

    if user and verify_password(password, user.hashed_password):
        return user
    
    return None


def update_user(db: Session, user_id: UUID, data: UserUpdate) -> Optional[User]:
    """Actualiza solo los campos que vienen en la petición (admin). Devuelve None si no existe."""
    user = get_user_by_id(db, user_id)

    if not user:
        return None
    
    # Solo se asignan campos que vienen e la petición
    if data.full_name is not None:
        user.full_name = data.full_name
    
    if data.email is not None:
        user.email = data.email
    
    if data.role is not None:
        user.role = data.role
    
    if data.company_id is not None:
        user.company_id = data.company_id
    
    if data.is_active is not None:
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    return user


def update_own_profile(db:Session, current_user: User, data: UserSelfUpdate) -> User:
    # No acepta role/company_id/is_active para que nadie se automodifique esos campos
    """El usuario edita su propio nombre y correo; nunca su rol, empresa o estado."""
    if data.full_name is not None:
        current_user.full_name = data.full_name

    if data.email is not None:
        current_user.email = data.email

    db.commit()
    db.refresh(current_user)

    return current_user


def deactivate_user(db: Session, user_id: UUID) -> Optional[User]:
    """Desactiva al usuario (no se borra). Devuelve None si no existe."""
    user = get_user_by_id(db, user_id)
    
    if not user:
        return None
    
    user.is_active = False
    
    db.commit()
    db.refresh(user)
    
    return user


def change_password(db: Session, current_user: User, data: PasswordChangeRequest) -> User:
    """Cambia la contraseña tras verificar la actual. Lanza ValueError si no coincide."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise ValueError("Current password is incorrect")

    current_user.hashed_password = hash_password(data.new_password)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


def create_user(db: Session, user_create: UserCreate) -> User:
    """Crea un usuario con la contraseña ya convertida en hash."""
    new_user = User(
        document_id=user_create.document_id,
        full_name=user_create.full_name,
        email=user_create.email,
        hashed_password=hash_password(user_create.password),
        role=user_create.role,
        company_id=user_create.company_id,
        is_active=user_create.is_active,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user



