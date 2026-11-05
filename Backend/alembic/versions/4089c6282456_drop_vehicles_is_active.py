"""drop vehicles is_active

Revision ID: 4089c6282456
Revises: 3f2633eb82df
Create Date: 2026-11-05 08:37:40.467569

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4089c6282456'
down_revision: Union[str, Sequence[str], None] = '3f2633eb82df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
  op.drop_column("vehicles", "is_active")


def downgrade() -> None:
  op.add_column("vehicles", sa.Column("is_active", sa.Boolean(), nullable=True))