from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func


class AuditMixin:
    # Mixin reutilizable con timestamps y trazabilidad de usuario. Toda entidad que lo herede, se le agregan estas 5 columnas automáticamente

    created_at =  Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at =  Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    created_by_user_id =  Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by_user_id =  Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deleted_by_user_id =  Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
