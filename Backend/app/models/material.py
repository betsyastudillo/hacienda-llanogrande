from sqlalchemy import Column, String, Numeric, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.database import Base
from app.models.mixins import AuditMixin


class Material(Base, AuditMixin):
    __tablename__ = "materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    approx_weight_kg = Column(Numeric(8, 2), nullable=True)  # Peso aproximado de 1 unidad, solo referencia
    price = Column(Numeric(10, 2), nullable=False) # Se usa Numeric porque no tiene errores de redondeo como Float
    unit = Column(String(20), nullable=False, default="kg")  # kg, unidad, tonelada, canasta, etc.
    tax_rate = Column(Numeric(5, 4), nullable=False, default=0.19) # 19% IVA pero editable
    is_active = Column(Boolean, nullable=False, default=True)

    parent_material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=True)
    units_per_pack = Column(Numeric(10, 3), nullable=True)  # ej. 24 (manzanas x24), 5 (libras de uva)

    # El remote_side es para conocer la relación padre, es decir, las manzanas son padre y los hijos son los grupos de presentación que se pueden encontrar. Con materials.packs da la lista de paquetes desde el producto, sin tener que consultarlo aparte.
    parent_material = relationship("Material", remote_side=[id], backref="packs")