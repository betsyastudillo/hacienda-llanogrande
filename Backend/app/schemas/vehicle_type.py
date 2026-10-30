from typing import Optional
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, field_validator, ConfigDict, Field


class VehicleTypeCreate(BaseModel):
  name: str
  capacity_kg: Optional[Decimal] = Field(default=None, gt=0)

  @field_validator("name")
  @classmethod
  def clean_name(cls, v):
    v = v.strip()
    if not (2 <= len(v) <= 50):
      raise ValueError("El nombre debe tener entre 2 y 50 caracteres")
    return v


class VehicleTypeUpdate(BaseModel):
  name: Optional[str] = None
  capacity_kg: Optional[Decimal] = Field(default=None, gt=0)
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
  capacity_kg: Optional[Decimal] = None
  is_active: bool