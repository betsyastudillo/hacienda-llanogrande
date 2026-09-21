import os
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.constants.permissions import ROLES_PERMISSIONS
from app.database import get_db
from app.services.auth_service import decode_access_token
from app.services.user_service import get_user_by_document_id


# Define a security scheme for HTTP Bearer authentication
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    try:
        # Se intenta decodificar el token para obtener la información del usuario
        payload = decode_access_token(token)
        document_id: str = payload.get("sub")
        if document_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    # Vuelve a consultar la base de datos para obtener el usuario completo y verificar si está activo
    user = get_user_by_document_id(db, document_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_role(*allowed_roles: str):
    def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return role_checker


# Permisos de roles. Exige que el usuario tenga exactamente este permiso. Se usa cuando el endpoint tiene una sola regla de acceso clara.
def require_permission(permission: str):
    def permission_checker(current_user=Depends(get_current_user)):
        role_permissions = ROLES_PERMISSIONS.get(current_user.role, set())

        if "*" in role_permissions:
            return current_user

        if permission not in role_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return permission_checker


# Verifica si un usuario tiene un permiso específico, sin lanzar excepciones. Es útil dentro de un endpoint para lógica condicional, ya que no corta la petición si no lo tiene, a diferencia de require_permission.
def user_has_permission(user, permission: str) -> bool:

    role_permissions = ROLES_PERMISSIONS.get(user.role, set())
    return "*" in role_permissions or permission in role_permissions


# Permisos para roles. Exige que el usuario tenga al menos 1 de estos permisos o el comodín '*'. Se usa cuando varios roles distintos deben poder entrar al mismo endpoint pero c/u con u alcance distinto que se filtra dentro de la función.
def require_any_permission(*permissions: str):
    def checker(current_user=Depends(get_current_user)):
        role_permissions = ROLES_PERMISSIONS.get(current_user.role, set())

        if "*" in role_permissions:
            return current_user

        if not any(p in role_permissions for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return checker