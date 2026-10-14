"""company fields for ubication

Revision ID: 137f0146f6e3
Revises: c0d340addb96
Create Date: 2026-10-14 15:23:11.532761

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '137f0146f6e3'
down_revision: Union[str, Sequence[str], None] = 'c0d340addb96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('country', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('department', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('city', sa.String(), nullable=True))
    op.execute("UPDATE companies SET country = 'Colombia' WHERE country IS NULL")

def downgrade() -> None:
    op.drop_column('companies', 'city')
    op.drop_column('companies', 'department')
    op.drop_column('companies', 'country')