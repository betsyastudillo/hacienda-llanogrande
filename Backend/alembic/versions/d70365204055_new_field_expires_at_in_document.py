"""new field expires_at in document

Revision ID: d70365204055
Revises: 026c9099be7e
Create Date: 2026-10-29 11:57:26.383407

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd70365204055'
down_revision: Union[str, Sequence[str], None] = '026c9099be7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('expires_at', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'expires_at')