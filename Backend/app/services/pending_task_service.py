from typing import List
from sqlalchemy.orm import Session
from app.models.company import Company
from app.schemas.pending_task import PendingTask


def get_pending_tasks(db: Session) -> List[PendingTask]:
  tasks = []

  pending_companies = db.query(Company).filter(Company.verification_status == "pending").all()
  for company in pending_companies:
    tasks.append(PendingTask(
      task_type="company_approval",
      reference_id=company.id,
      title=f"Aprobar empresa: {company.legal_name}",
      description=f"Código {company.client_code} · creada el {company.created_at.strftime('%d/%m/%Y')}",
      created_at=company.created_at,
    ))

  # Aquí se agregan más adelante las diferencias del inventario

  tasks.sort(key=lambda t: t.created_at)
  return tasks