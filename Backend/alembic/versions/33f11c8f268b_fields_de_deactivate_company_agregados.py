"""fields de deactivate company agregados

Revision ID: 33f11c8f268b
Revises: 191089d5f264
Create Date: 2026-10-16 16:17:49.933143

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '33f11c8f268b'
down_revision: Union[str, Sequence[str], None] = '191089d5f264'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('deactivation_reason', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('deactivated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('companies', sa.Column('deactivated_by_user_id', postgresql.UUID(as_uuid=True),
                                         sa.ForeignKey('users.id'), nullable=True))

def downgrade() -> None:
    op.drop_column('companies', 'deactivated_by_user_id')
    op.drop_column('companies', 'deactivated_at')
    op.drop_column('companies', 'deactivation_reason')
