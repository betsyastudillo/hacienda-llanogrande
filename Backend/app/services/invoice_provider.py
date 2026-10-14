import base64
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class ProviderResult:
  invoice_number: str
  cufe: str
  issued_at: datetime
  signed_at: datetime
  signature: str
  qr_data: str
  provider: str


# Imita al proveedor tecnológico. Todo valor va a quedar marcado como Prueba
class SimulatedProvider:
  name = "simulado"

  def emit(self, order, invoice) -> ProviderResult:
    now = datetime.now(timezone.utc)
    number = f"{order.order_number}"
    raw = f"{number}|{invoice.total}|{now.isoformat()}".encode()

    cufe = "PRUEBA-" + hashlib.sha384(raw).hexdigest()
    signature = "PRUEBA-" + base64.b64encode(hashlib.sha512(raw).digest()).decode()
    qr_data = f"SIMULACION SIN VALIDEZ FISCAL | {number} | {cufe[:30]}"

    return ProviderResult(number, cufe, now, now, signature, qr_data, self.name)


# Al integrar: crear FacturatechProvider con el mismo método emit() y devolverlo aquí
def get_provider():
  return SimulatedProvider()