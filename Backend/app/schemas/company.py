import re
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, field_validator, model_validator
from uuid import UUID
from app.schemas.mixins import AuditResponseMixin
from app.constants.company_requirements import LEGAL_REP_FIELDS

# Validaciones para teléfono y email, para que no los envíen con un caracter cualquiera
EMAIL_REGEX = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
PHONE_REGEX = re.compile(r"\d{7,15}")

# Validación para código de actividad economica
CIIU_REGEX = re.compile(r"\d{4}")

# Validación para campos de representante legal

VALID_LEGAL_REP_DOCUMENT_TYPES = ("CC", "CE", "PP", "PPT", "PEP")

class CompanyBase (BaseModel):
  legal_name: str
  display_name: Optional[str] = None
  document_type: Optional[str] = None
  document_number: str
  company_type: str
  business_sector: Optional[Literal["construccion", "agro"]] = None
  person_type: str = "juridica"
  address: str
  phone: str
  email: str
  economic_activity_code: Optional[str] = None
  economic_activity_description: Optional[str] = None
  fiscal_address : Optional[str] = None
  fiscal_phone : Optional[str] = None
  fiscal_email: Optional[str] = None
  legal_rep_name: Optional[str] = None
  legal_rep_document_type: Optional[str] = None
  legal_rep_document_number: Optional[str] = None
  legal_rep_email: Optional[str] = None
  legal_rep_city: Optional[str] = None

class CompanyCreate(CompanyBase):

  # Le dice a Pydantic que después de comprobar que el valor es un texto, ejecute esta función
  # Si devuelve el valor, se acepta
  # Si lanza valueError, se corta la petición y responde 422 sin llegar al router
  @field_validator("phone", "fiscal_phone")
  @classmethod # Lo exige Pydantic
  def validate_phone(cls, value):
    if value is None: # Ya que el fiscal_phone es Opcional
      return value
    
    # El fullmatch exige que todo el texto cumpla el patrón
    if not PHONE_REGEX.fullmatch(value):
      raise ValueError("El teléfono debe contener sólo números (entre 7 a 15 digitos)")
    
    return value

  @field_validator("email", "fiscal_email", "legal_rep_email")
  @classmethod
  def validate_email(cls, value):
    if value is None:
      return value
    
    if not EMAIL_REGEX.fullmatch(value):
      raise ValueError("El correo no tiene un formato válido")
    
    return value
  
  @model_validator(mode="after")
  def validate_legal_representative(self):
    if self.person_type == "juridica":
      missing = [f for f in LEGAL_REP_FIELDS if not (getattr(self, f, None) or "").strip()]
      if missing:
        raise ValueError(f"Faltan datos del representante legal: {', '.join(missing)}")

      if any(not (getattr(self, f) or "").strip() for f in LEGAL_REP_FIELDS):
        raise ValueError("Los datos del representante legal son obligatorios para persona jurídica")
      if self.legal_rep_document_type not in VALID_LEGAL_REP_DOCUMENT_TYPES:
        raise ValueError("Tipo de documento del representante no válido")
    else:
      # Una persona natural no tiene representante: se descartan
      for f in LEGAL_REP_FIELDS:
        setattr(self, f, None)
    return self
  
  @field_validator("economic_activity_code")
  @classmethod
  def validate_ciiu(cls, value):
    if value is None or value == "":
      return None
    if not CIIU_REGEX.fullmatch(value):
      raise ValueError("El código CIIU debe tener 4 dígitos")
    return value

class CompanyVerifyRequest(BaseModel):
  decision: Literal["approved", "rejected"]
  rejection_reason: Optional[str] = None
  rejection_type: Optional[Literal["documents", "compliance"]] = None

class CompanyResponse(CompanyBase, AuditResponseMixin):
  id: UUID
  client_code: str
  verification_status: str
  verified_at: Optional[datetime] = None
  verified_by_user_id: Optional[UUID] = None
  rejection_reason: Optional[str] = None
  rejection_type: Optional[str] = None
  is_active: bool
  needs_action: bool = False

  class Config:
    from_attributes = True