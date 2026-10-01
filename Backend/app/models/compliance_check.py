from sqlalchemy import Column, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class ComplianceCheck(Base, AuditMixin):
  __tablename__ = "compliance_checks"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
  check_key = Column(String, nullable=False)  # "listas_vinculantes", "antecedentes_judiciales", etc.
  has_findings = Column(Boolean, nullable=False, default=False) # Si tiene recomendaciones
  note = Column(String, nullable=True)

  __table_args__ = (
    UniqueConstraint("company_id", "check_key", name="uq_compliance_check_company_key"),
  )
  # UniqueConstraint garantiza que no se repita el mismo check_key para la misma empresa.