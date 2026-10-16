"""unique carrier table

Revision ID: 191089d5f264
Revises: 96edd8802ed4
Create Date: 2026-10-16 08:55:17.587314

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '191089d5f264'
down_revision: Union[str, Sequence[str], None] = '96edd8802ed4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_unique_constraint('uq_carrier_document', 'carriers', ['document_type', 'document_id'])


def downgrade() -> None:
  op.drop_constraint('uq_carrier_document', 'carriers', type_='unique')