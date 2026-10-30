from typing import Optional
from uuid import UUID
from pydantic import BaseModel, field_validator, ConfigDict


class VehicleTypeCreate(BaseModel):
  name: str

  @field_validator("name")
  @classmethod
  def clean_name(cls, v):
    v = v.strip()
    if not (2 <= len(v) <= 50):
      raise ValueError("El nombre debe tener entre 2 y 50 caracteres")
    return v


class VehicleTypeUpdate(BaseModel):
  name: Optional[str] = None
  is_active: Optional[bool] = None

  @field_validator("name")
  @classmethod
  def clean_name(cls, v):
    if v is None:
      return v
    v = v.strip()
    if not (2 <= len(v) <= 50):
      raise ValueError("El nombre debe tener entre 2 y 50 caracteres")
    return v


class VehicleTypeResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  code: str
  name: str
  is_active: bool