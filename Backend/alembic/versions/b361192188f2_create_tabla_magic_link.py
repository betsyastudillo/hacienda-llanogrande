"""create tabla magic_link

Revision ID: b361192188f2
Revises: 6de909b25201
Create Date: 2026-09-26 08:53:56.516771

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b361192188f2'
down_revision: Union[str, Sequence[str], None] = '6de909b25201'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
