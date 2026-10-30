import re
from typing import Optional


def format_account_number(value: Optional[str]) -> str:
  """'12345678901' -> '1234 5678 901'"""
  if not value:
    return ""
  digits = re.sub(r"\D", "", str(value))
  return " ".join(digits[i:i + 4] for i in range(0, len(digits), 4))


def format_nit(value: Optional[str], dv: Optional[str] = None) -> str:
  """'900123456' -> '900.123.456'  |  con dígito de verificación -> '900.123.456-7'"""
  if not value:
    return ""
  digits = re.sub(r"\D", "", str(value))
  # Agrupa de a 3 desde la derecha, que es como se escribe un NIT
  grouped = re.sub(r"(?<=\d)(?=(\d{3})+$)", ".", digits)
  return f"{grouped}-{dv}" if dv else grouped

# app/utils/formatting.py  (agrega esta función; format_nit queda igual)
def format_document(doc_type: Optional[str], number: Optional[str]) -> str:
    """('NIT', '900123456-7') -> 'NIT 900.123.456-7'
       ('CC', '1234567890')   -> 'CC 1.234.567.890'"""
    doc_type = (doc_type or "").strip()
    number = (number or "").strip()
    if not number:
        return doc_type

    # Separa el dígito de verificación si viene como '900123456-7'
    base, dv = number, None
    if "-" in number:
        base, dv = number.rsplit("-", 1)

    if doc_type.upper() in ("NIT", "CC"):
        formatted = format_nit(base, dv.strip() if dv else None)
    else:
        formatted = number  # otros tipos (pasaporte, CE...) se dejan como vienen

    return f"{doc_type} {formatted}".strip()