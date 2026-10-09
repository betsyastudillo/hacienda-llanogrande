import re
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, field_validator
from uuid import UUID
from app.schemas.mixins import AuditResponseMixin


# Validaciones para teléfono y email, para que no los envíen con un caracter cualquiera
EMAIL_REGEX = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
PHONE_REGEX = re.compile(r"\d{7,15}")


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
  fiscal_address : Optional[str] = None
  fiscal_phone : Optional[str] = None
  fiscal_email : Optional[str] = None

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

  @field_validator("email", "fiscal_email")
  @classmethod
  def validate_email(cls, value):
    if value is None:
      return value
    
    if not EMAIL_REGEX.fullmatch(value):
      raise ValueError("El correo no tiene un formato válido")
    
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