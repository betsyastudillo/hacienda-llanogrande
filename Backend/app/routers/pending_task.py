from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth_dependencies import AdminOnly
from app.schemas.pending_task import PendingTask
from app.services.pending_task_service import get_pending_tasks

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/pending-tasks", response_model=list[PendingTask])
def list_pending_tasks(
    current_user: AdminOnly,
    db: Session = Depends(get_db),
):
    return get_pending_tasks(db)