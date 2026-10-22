from sqlalchemy import Column, String, Numeric, Date, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Vehicle(Base, AuditMixin):
  __tablename__ = "vehicles"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  type = Column(String(20), nullable=False)
  capacity_m3 = Column(Numeric(6, 2), nullable=False)
  plate = Column(String(10), unique=True, nullable=False)
  is_active = Column(Boolean, default=True)

  # Datos del propietario del vehículo
  owner_name = Column(String(100), nullable=True)
  owner_document_type = Column(String(10), nullable=True)
  owner_document_id = Column(String(100), nullable=True)
  owner_phone = Column(String(15), nullable=True)