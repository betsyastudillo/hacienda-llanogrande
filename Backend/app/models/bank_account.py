from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin

class BankAccount(Base, AuditMixin):
    __tablename__ = 'bank_accounts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)  # Se coloca por si en algún momento van a tener otras razones sociales para pagos bancarios.
    bank_name = Column(String, nullable=False)
    account_type = Column(String, nullable=False)  # ahorros / corriente
    account_number = Column(String, nullable=False)
    account_holder_name = Column(String, nullable=False) # Titular
    account_holder_document_type = Column(String, nullable=False)  # CC, NIT, CE, etc.
    account_holder_document_number = Column(String, nullable=False) # Documento del titular de la cuenta
    agreement_number = Column(String, nullable=True) # Convenio (si aplica).
    is_active = Column(Boolean, default=True, nullable=False)