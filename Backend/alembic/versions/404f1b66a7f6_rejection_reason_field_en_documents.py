"""rejection_reason field en documents 

Revision ID: 404f1b66a7f6
Revises: 53385672ddbb
Create Date: 2026-10-22 11:47:45.385254

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '404f1b66a7f6'
down_revision: Union[str, Sequence[str], None] = '53385672ddbb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('rejection_reason', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'rejection_reason')