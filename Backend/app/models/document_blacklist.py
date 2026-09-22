from sqlalchemy import Column, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class DocumentBlacklist(Base, AuditMixin):
    __tablename__ = "document_blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_type = Column(String, nullable=False)  # CC, CE, NIT, etc.
    document_number = Column(String, nullable=False, index=True)
    reason = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)  # permite "des-vetar" sin borrar el historial

    __table_args__ = (
        UniqueConstraint("document_type", "document_number", name="uq_blacklist_type_number"),
    )