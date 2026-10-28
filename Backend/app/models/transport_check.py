import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.mixins import AuditMixin


class TransportCheck(Base, AuditMixin):
  __tablename__ = "transport_checks"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
  subject = Column(String, nullable=False)       # vehicle | owner | carrier
  check_key = Column(String, nullable=False)     # simit | listas_vinculantes | antecedentes_judiciales
  has_findings = Column(Boolean, nullable=False)
  note = Column(String, nullable=True)
  subject_ref = Column(String, nullable=True)   # placa, o tipo y número del documento."
  __table_args__ = (
    UniqueConstraint("assignment_id", "subject", "check_key", name="uq_transport_check"),
  )