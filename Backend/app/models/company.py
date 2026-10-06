from sqlalchemy import Column, DateTime, ForeignKey, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin

class Company(Base, AuditMixin):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_code = Column(String, unique=True, nullable=False) # Código de cliente para facilitar memorización y agilización en procesos futuros.
    legal_name = Column(String, nullable=False) # Nombre tal cual aparece en el RUT o C y Cio.
    display_name = Column(String, nullable=True)  # Nombre corto para mostrar en la UI; si es null, se usa legal_name
    document_type = Column(String, nullable=False, default="NIT") # PN: CC, PP, etc. PJ: Nit
    document_number = Column(String, nullable=False)
    company_type = Column(String, nullable=False) # El 1 registro es "own" para identificarse, los siguientes son "client"
    business_sector = Column(String, nullable=True)  # Construccion | Agro 
    person_type = Column(String, nullable=False, default="juridica") # natural | juridica

    # Datos operativos | Contacto del día a día
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)

    # Datos fiscales | Tal como aparecen en el RUT, si son null, se asume que coinciden con los operativos
    fiscal_address = Column(String, nullable=True)
    fiscal_phone = Column(String, nullable=True)
    fiscal_email = Column(String, nullable=True)
    
    verification_status = Column(String, nullable=False) # La empresa pasa a un estado de " en revisión" al crearse, y pasa a "verificado / aprobado" o cuando el admin da la aprobación
    is_active = Column(Boolean, default=True, nullable=False) # Si es cliente activo o por algún motivo ya no lo es, no se elimina, solo cambia de estado, para que conserve el historial de clientes.

    # Campos para la verificación de la empresa (historial)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejection_type = Column(String, nullable=True) # Si es documents es corregible si es por comlistas vinculantes es rechazo definitivo
    rejection_reason = Column(String, nullable=True)