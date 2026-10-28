"""new field subject_ref in  transport_check

Revision ID: 026c9099be7e
Revises: ae76c9a8756c
Create Date: 2026-10-28 06:46:00.695076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '026c9099be7e'
down_revision: Union[str, Sequence[str], None] = 'ae76c9a8756c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('transport_checks', sa.Column('subject_ref', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('transport_checks', 'subject_ref')