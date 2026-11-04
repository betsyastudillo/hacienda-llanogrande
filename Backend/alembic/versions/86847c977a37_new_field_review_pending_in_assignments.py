"""new field review_pending in assignments

Revision ID: 86847c977a37
Revises: 8b0c5047bfb5
Create Date: 2026-11-03 09:27:04.537967

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86847c977a37'
down_revision: Union[str, Sequence[str], None] = '8b0c5047bfb5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
  op.add_column("assignments", sa.Column("review_pending", sa.Boolean(), nullable=False, server_default=sa.false()))

def downgrade():
  op.drop_column("assignments", "review_pending")