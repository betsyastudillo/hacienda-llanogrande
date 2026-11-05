"""add dispatch_guides entered_at

Revision ID: 9f17c7df6f41
Revises: 4089c6282456
Create Date: 2026-11-05 10:17:55.834378

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f17c7df6f41'
down_revision: Union[str, Sequence[str], None] = '4089c6282456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.add_column("dispatch_guides", sa.Column("entered_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
  op.drop_column("dispatch_guides", "entered_at")