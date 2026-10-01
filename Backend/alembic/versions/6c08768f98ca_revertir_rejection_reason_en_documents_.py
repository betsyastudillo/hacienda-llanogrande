"""revertir rejection_reason en documents, no se usa

Revision ID: 6c08768f98ca
Revises: f4dbb0e4bb59
Create Date: 2026-10-01 16:04:14.831353

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6c08768f98ca'
down_revision: Union[str, Sequence[str], None] = 'eb04c5483262' 
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('documents', 'rejection_reason')


def downgrade() -> None:
    op.add_column('documents', sa.Column('rejection_reason', sa.String(), nullable=True))
