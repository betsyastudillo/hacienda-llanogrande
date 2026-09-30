from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class PendingTask(BaseModel):
    task_type: str  # Por ahora: "company_approval" o aprobar empresas, pero a futuro, irían las diferencias en inventario
    reference_id: UUID
    title: str
    description: Optional[str] = None
    created_at: datetime