from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin

class DispatchGuide(Base, AuditMixin):
    __tablename__ = "dispatch_guides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), unique=True, nullable=False)
    token = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, used
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    cargo_detail = Column(String, nullable=False)
    qr_image_url = Column(String, nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)