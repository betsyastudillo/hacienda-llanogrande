"""drop vehicles capacity_m3

Revision ID: 3f2633eb82df
Revises: 86847c977a37
Create Date: 2026-11-05 08:10:10.692438

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f2633eb82df'
down_revision: Union[str, Sequence[str], None] = '86847c977a37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.drop_column("vehicles", "capacity_m3")


def downgrade() -> None:
  op.add_column(
    "vehicles",
    sa.Column("capacity_m3", sa.Numeric(6, 2), nullable=False, server_default="0"),
  )
  op.alter_column("vehicles", "capacity_m3", server_default=None)