from datetime import datetime, timezone
from zoneinfo import ZoneInfo

LOCAL_TZ = ZoneInfo("America/Bogota")
MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']


def to_local(dt: datetime) -> datetime:
  # Una fecha sin zona se toma como UTC, igual que las que guarda la base
  """Convierte una fecha a hora de Colombia (una fecha sin zona se toma como UTC)."""
  if dt.tzinfo is None:
    dt = dt.replace(tzinfo=timezone.utc)
  
  return dt.astimezone(LOCAL_TZ)


def format_date(dt: datetime, with_time: bool = False) -> str:
  """Formatea una fecha como '05 / NOV / 2026', con hora opcional."""
  d = to_local(dt)
  text = f"{d.day:02d} / {MONTHS_ES[d.month - 1]} / {d.year}"

  return f"{text} {d:%H:%M:%S}" if with_time else text


# Dirección completa para los PDF de proforma y FE
def full_address(c) -> str:
    """Dirección completa para los PDF: dirección fiscal (o la operativa), ciudad, departamento y país."""
    parts = [c.fiscal_address or c.address, c.city, c.department, c.country]
    return ", ".join(x for x in parts if x)