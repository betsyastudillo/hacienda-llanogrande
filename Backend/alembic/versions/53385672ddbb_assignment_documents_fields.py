"""assignment documents fields

Revision ID: 53385672ddbb
Revises: 9130bc036290
Create Date: 2026-10-21 16:18:24.917860

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '53385672ddbb'
down_revision: Union[str, Sequence[str], None] = '9130bc036290'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
  op.add_column('vehicles', sa.Column('owner_name', sa.String(100), nullable=True))
  op.add_column('vehicles', sa.Column('owner_document_type', sa.String(10), nullable=True))
  op.add_column('vehicles', sa.Column('owner_document_id', sa.String(100), nullable=True))
  op.add_column('vehicles', sa.Column('owner_phone', sa.String(15), nullable=True))


def downgrade() -> None:
  op.drop_column('vehicles', 'owner_phone')
  op.drop_column('vehicles', 'owner_document_id')
  op.drop_column('vehicles', 'owner_document_type')
  op.drop_column('vehicles', 'owner_name')