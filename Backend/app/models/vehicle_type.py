import uuid
from sqlalchemy import Column, String, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.mixins import AuditMixin  # usa la ruta real de tu mixin


class VehicleType(Base, AuditMixin):
  __tablename__ = "vehicle_types"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  code = Column(String(20), unique=True, nullable=False)   #es lo que guarda Vehicle.type
  name = Column(String(50), nullable=False)      
  capacity_kg = Column(Numeric(10, 2), nullable=True)          
  is_active = Column(Boolean, nullable=False, default=True)