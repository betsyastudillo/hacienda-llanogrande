from sqlalchemy import Column, String, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Material(Base, AuditMixin):
    __tablename__ = "materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)
    approx_weight_kg = Column(Numeric(8, 2), nullable=True)  # peso aproximado de 1 unidad de "unit", solo referencia
    price = Column(Numeric(10, 2), nullable=False) # Se usa Numeric porque no tiene errores de redondeo como Float
    unit = Column(String(20), nullable=False, default="kg")  # kg, unidad, tonelada, canasta, etc.
    tax_rate = Column(Numeric(5, 4), nullable=False, default=0.19) # 19% IVA pero editable
    is_active = Column(Boolean, nullable=False, default=True)