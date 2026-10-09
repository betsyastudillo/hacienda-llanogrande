"""add fields of code CIIU

Revision ID: cb93789ef0a8
Revises: 0baf21b459f5
Create Date: 2026-10-09 09:56:26.100458

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb93789ef0a8'
down_revision: Union[str, Sequence[str], None] = '0baf21b459f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('economic_activity_code', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('economic_activity_description', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'economic_activity_description')
    op.drop_column('companies', 'economic_activity_code')