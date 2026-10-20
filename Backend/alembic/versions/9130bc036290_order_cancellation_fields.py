"""order cancellation fields

Revision ID: 9130bc036290
Revises: 33f11c8f268b
Create Date: 2026-10-20 15:35:46.125646

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9130bc036290'
down_revision: Union[str, Sequence[str], None] = '33f11c8f268b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import postgresql

def upgrade() -> None:
  op.add_column('orders', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
  op.add_column('orders', sa.Column('cancelled_by_user_id', postgresql.UUID(as_uuid=True),sa.ForeignKey('users.id'), nullable=True))
  op.add_column('orders', sa.Column('cancellation_reason', sa.String(), nullable=True))


def downgrade() -> None:
  op.drop_column('orders', 'cancellation_reason')
  op.drop_column('orders', 'cancelled_by_user_id')
  op.drop_column('orders', 'cancelled_at')