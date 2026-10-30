"""new field in  vehicle_type

Revision ID: 8b0c5047bfb5
Revises: b20a419215c4
Create Date: 2026-10-30 15:24:38.734761

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b0c5047bfb5'
down_revision: Union[str, Sequence[str], None] = 'b20a419215c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
  op.add_column("vehicle_types", sa.Column("capacity_kg", sa.Numeric(10, 2), nullable=True))

def downgrade():
  op.drop_column("vehicle_types", "capacity_kg")