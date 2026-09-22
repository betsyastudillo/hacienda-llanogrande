from sqlalchemy import Column, String, Date, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Carrier(Base, AuditMixin):
    __tablename__ = "carriers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(100), nullable=False)
    document_type = Column(String(10), nullable=False)  # CC, CE, NIT, etc.
    document_id = Column(String(100), nullable=False)
    phone = Column(String(15), nullable=False)
    address = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)