"""invoice provider fields

Revision ID: c0d340addb96
Revises: 14e6f72f401c
Create Date: 2026-10-13 15:20:43.443241

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0d340addb96'
down_revision: Union[str, Sequence[str], None] = '14e6f72f401c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signature VARCHAR")
    op.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider VARCHAR")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS draft_pdf_url")
    # Facturas pendientes sin PDF que dejó el relleno de la migración original
    op.execute("DELETE FROM invoices WHERE status = 'pending'")


def downgrade() -> None:
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS provider")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS signature")
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS signed_at")