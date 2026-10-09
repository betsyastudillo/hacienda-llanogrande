from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from app.schemas.mixins import AuditResponseMixin


class ComplianceCheckUpsert(BaseModel):
  has_findings: bool = False
  note: Optional[str] = None


class ComplianceCheckResponse(AuditResponseMixin):
  id: UUID
  company_id: UUID
  check_key: str
  has_findings: bool
  note: Optional[str] = None
  subject: str

  class Config:
    from_attributes = True