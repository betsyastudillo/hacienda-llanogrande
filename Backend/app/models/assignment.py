from sqlalchemy import Boolean, Column, ForeignKey, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Assignment(Base, AuditMixin):
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), unique=True, nullable=False) #unique=True porque un pedido solo debe tener 1 asignación activa a la vez
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    carrier_id = Column(UUID(as_uuid=True), ForeignKey("carriers.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    validation_status = Column(String, nullable=False, default="pending")  # Pendiente | Aprobado | Rechazado
    rejection_reason = Column(String, nullable=True) # Razón del rechazo
    background_check_verified = Column(Boolean, nullable=False, default=False)  # Logistica confirma que consultó antecedentes
    validated_at = Column(DateTime(timezone=True), nullable=True) # Momento en que logistica valida la entrada de vehículo y transportador.
    validated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Qué usuario validó esa aprobación