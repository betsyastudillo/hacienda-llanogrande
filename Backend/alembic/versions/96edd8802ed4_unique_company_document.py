"""unique company document

Revision ID: 96edd8802ed4
Revises: 137f0146f6e3
Create Date: 2026-10-15 10:00:58.463399

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '96edd8802ed4'
down_revision: Union[str, Sequence[str], None] = '137f0146f6e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint('uq_company_document', 'companies', ['document_type', 'document_number'])


def downgrade() -> None:
    op.drop_constraint('uq_company_document', 'companies', type_='unique')