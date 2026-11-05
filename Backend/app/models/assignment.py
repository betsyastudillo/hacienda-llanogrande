import uuid
from sqlalchemy import Boolean, Column, ForeignKey, DateTime, String, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.mixins import AuditMixin
from app.models.assignment_item import AssignmentItem

class Assignment(Base, AuditMixin):
  __tablename__ = "assignments"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True) 
  sequence = Column(Integer, nullable=False, default=1)           # Num de retiro
  cancelled_at = Column(DateTime(timezone=True), nullable=True)    # Por si se anulan después
  cancellation_reason = Column(String(255), nullable=True)
  vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
  carrier_id = Column(UUID(as_uuid=True), ForeignKey("carriers.id"), nullable=False)
  assigned_at = Column(DateTime(timezone=True), server_default=func.now())
  validation_status = Column(String, nullable=False, default="pending")  # Pendiente | Aprobado | Rechazado
  rejection_reason = Column(String, nullable=True) # Razón del rechazo
  background_check_verified = Column(Boolean, nullable=False, default=False)  # Logistica confirma que consultó antecedentes
  validated_at = Column(DateTime(timezone=True), nullable=True) # Momento en que logistica valida la entrada de vehículo y transportador.
  validated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Qué usuario validó esa aprobación
  review_pending = Column(Boolean, nullable=False, default=False)  # Cuando hay cambio autorizado; faltan consultas y documentos

  items = relationship("AssignmentItem", back_populates="assignment", cascade="all, delete-orphan")

  __table_args__ = (UniqueConstraint("order_id", "sequence", name="uq_assignments_order_sequence"),)