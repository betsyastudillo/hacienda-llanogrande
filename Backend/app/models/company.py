from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_code = Column(String, unique=True, nullable=False) # Código de cliente para facilitar memorización y agilización en procesos futuros.
    legal_name = Column(String, nullable=False)
    nit = Column(String, nullable=False)
    type = Column(String, nullable=False) # El 1 registro es "own" para identificarse, los siguientes son "client"
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)
    verification_status = Column(String, nullable=False) # La empresa pasa a un estado de " en revisión" al crearse, y pasa a "verificado / aprobado" cuando se revisa la documentación
    is_active = Column(Boolean, default=True, nullable=False) # Si es cliente activo o por algún motivo ya no lo es, no se elimina, solo cambia de estado, para que conserve el historial de clientes.