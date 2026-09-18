from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Document(Base, AuditMixin):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    carrier_id = Column(UUID(as_uuid=True), ForeignKey("carriers.id"), nullable=True)
    document_type = Column(String, nullable=False)
    document_url = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")