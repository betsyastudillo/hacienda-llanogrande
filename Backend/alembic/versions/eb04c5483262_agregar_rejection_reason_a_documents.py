"""agregar rejection_reason a documents

Revision ID: eb04c5483262
Revises: f4dbb0e4bb59
Create Date: 2026-10-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'eb04c5483262'
down_revision: Union[str, Sequence[str], None] = 'f4dbb0e4bb59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('rejection_reason', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'rejection_reason')